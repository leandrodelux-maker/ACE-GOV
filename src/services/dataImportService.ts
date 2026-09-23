import { supabase } from './supabaseClient';

export interface ImportJobRecord {
  id?: string;
  municipality_id: string;
  entity_type: string;
  file_name: string;
  file_size_bytes: number;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  duplicate_records: number;
  status: 'PROCESSANDO' | 'CONCLUIDO' | 'FALHA' | 'CANCELADO';
  error_summary?: any;
  created_at?: string;
}

export interface ColumnMapping {
  fileColumn: string;
  targetField: string;
  required: boolean;
}


export const dataImportService = {
  // 1. Obter campos obrigatórios e esperados por entidade
  getEntitySchema(entityType: string): { label: string; fields: { name: string; label: string; required: boolean }[] } {
    switch (entityType) {
      case 'PROPERTIES':
        return {
          label: 'Imóveis',
          fields: [
            { name: 'code', label: 'Código do Imóvel / Inscrição', required: true },
            { name: 'address', label: 'Logradouro / Rua', required: true },
            { name: 'number', label: 'Número', required: true },
            { name: 'neighborhood_name', label: 'Nome do Bairro', required: true },
            { name: 'block_code', label: 'Código do Quarteirão / Quadra', required: false },
            { name: 'type', label: 'Tipo (RESIDENCIAL, COMERCIAL, etc.)', required: false },
            { name: 'latitude', label: 'Latitude (GPS)', required: false },
            { name: 'longitude', label: 'Longitude (GPS)', required: false },
          ],
        };
      case 'NEIGHBORHOODS':
        return {
          label: 'Bairros',
          fields: [
            { name: 'name', label: 'Nome do Bairro', required: true },
            { name: 'code', label: 'Código Oficial', required: false },
            { name: 'population', label: 'População Estimada', required: false },
          ],
        };
      case 'AGENTS':
        return {
          label: 'Agentes de Combate às Endemias (ACE)',
          fields: [
            { name: 'full_name', label: 'Nome Completo', required: true },
            { name: 'registration_number', label: 'Matrícula', required: true },
            { name: 'email', label: 'E-mail Funcional', required: false },
            { name: 'phone', label: 'Telefone', required: false },
          ],
        };
      case 'STRATEGIC_POINTS':
        return {
          label: 'Pontos Estratégicos (PE)',
          fields: [
            { name: 'name', label: 'Nome Fantasia / Estabelecimento', required: true },
            { name: 'type', label: 'Tipo de PE (Borracharia, Ferro Velho, etc.)', required: true },
            { name: 'address', label: 'Endereço', required: true },
            { name: 'neighborhood_name', label: 'Bairro', required: true },
          ],
        };
      case 'OVITRAPS':
        return {
          label: 'Ovitrampas (Armadilhas)',
          fields: [
            { name: 'code', label: 'Código da Armadilha', required: true },
            { name: 'address', label: 'Endereço de Instalação', required: true },
            { name: 'neighborhood_name', label: 'Bairro', required: true },
          ],
        };
      default:
        return { label: 'Entidade Genérica', fields: [] };
    }
  },

  // 2. Parse de CSV simples no client-side
  parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Detectar separador (, ou ;)
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';

    const headers = headerLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= headers.length) {
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx] || '';
        });
        rows.push(rowObj);
      }
    }

    return { headers, rows };
  },

  // 3. Execução da Importação em Lotes com Gravação em import_jobs
  async executeBatchImport(
    entityType: string,
    fileName: string,
    fileSizeBytes: number,
    rows: any[],
    mapping: Record<string, string>,
    updateExisting = true,
    municipalityId: string
  ): Promise<{ success: boolean; job: ImportJobRecord; errors: any[] }> {
    const totalRecords = rows.length;
    let validRecords = 0;
    let invalidRecords = 0;
    let duplicateRecords = 0;
    const errors: any[] = [];
    let neighborhoodByName: Map<string, string> | null = null;

    try {
      // 1. Criar registro inicial do job
      const { data: jobData, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({
          municipality_id: municipalityId,
          entity_type: entityType,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          total_records: totalRecords,
          valid_records: 0,
          invalid_records: 0,
          duplicate_records: 0,
          status: 'PROCESSANDO',
        })
        .select()
        .single();

      const jobId = jobData?.id;

      // 2. Processar linhas
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mappedRow: Record<string, any> = {};

        // Aplicar mapeamento
        Object.entries(mapping).forEach(([targetField, sourceCol]) => {
          if (sourceCol && row[sourceCol] !== undefined) {
            mappedRow[targetField] = row[sourceCol];
          }
        });

        // Validação básica
        if (entityType === 'PROPERTIES') {
          if (!mappedRow.code || !mappedRow.address) {
            invalidRecords++;
            errors.push({ line: i + 2, reason: 'Código ou Logradouro não informado' });
            continue;
          }

          // Checar se já existe no banco
          const { data: existing } = await supabase
            .from('properties')
            .select('id')
            .eq('municipality_id', municipalityId)
            .eq('property_code', mappedRow.code)
            .maybeSingle();

          // properties.neighborhood_id é obrigatório: resolve o bairro pelo nome informado
          if (!neighborhoodByName) {
            const { data: neighs } = await supabase.from('neighborhoods').select('id, name').eq('municipality_id', municipalityId);
            neighborhoodByName = new Map((neighs || []).map((n: any) => [String(n.name).trim().toLowerCase(), n.id]));
          }
          const neighborhoodId = neighborhoodByName.get(String(mappedRow.neighborhood_name || '').trim().toLowerCase());
          const toCoord = (v: unknown) => {
            const n = parseFloat(String(v ?? '').replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          };
          const fields = {
            street: mappedRow.address,
            number: mappedRow.number || 'S/N',
            ...(mappedRow.type ? { property_type: String(mappedRow.type).toUpperCase() } : {}),
            ...(toCoord(mappedRow.latitude) !== null ? { latitude: toCoord(mappedRow.latitude) } : {}),
            ...(toCoord(mappedRow.longitude) !== null ? { longitude: toCoord(mappedRow.longitude) } : {}),
          };

          if (existing) {
            if (updateExisting) {
              const { error: updErr } = await supabase
                .from('properties')
                .update({ ...fields, ...(neighborhoodId ? { neighborhood_id: neighborhoodId } : {}), updated_at: new Date().toISOString() })
                .eq('id', existing.id);
              if (updErr) {
                invalidRecords++;
                errors.push({ line: i + 2, reason: `Falha ao atualizar: ${updErr.message}` });
                continue;
              }
              duplicateRecords++;
              validRecords++;
            } else {
              duplicateRecords++;
            }
          } else {
            if (!neighborhoodId) {
              invalidRecords++;
              errors.push({ line: i + 2, reason: `Bairro "${mappedRow.neighborhood_name || ''}" não cadastrado no município` });
              continue;
            }
            const { error: insErr } = await supabase.from('properties').insert({
              municipality_id: municipalityId,
              neighborhood_id: neighborhoodId,
              property_code: mappedRow.code,
              ...fields,
            });
            if (insErr) {
              invalidRecords++;
              errors.push({ line: i + 2, reason: `Falha ao gravar: ${insErr.message}` });
              continue;
            }
            validRecords++;
          }
        } else if (entityType === 'NEIGHBORHOODS') {
          const name = String(mappedRow.name || '').trim();
          if (!name) {
            invalidRecords++;
            errors.push({ line: i + 2, reason: 'Nome do bairro não informado' });
            continue;
          }
          const { data: existingN } = await supabase
            .from('neighborhoods')
            .select('id')
            .eq('municipality_id', municipalityId)
            .ilike('name', name)
            .maybeSingle();
          if (existingN) {
            duplicateRecords++;
            continue;
          }
          const population = parseInt(String(mappedRow.population || ''), 10);
          const { error: nErr } = await supabase.from('neighborhoods').insert({
            municipality_id: municipalityId,
            name,
            code: mappedRow.code || null,
            population: Number.isFinite(population) ? population : null,
          });
          if (nErr) {
            invalidRecords++;
            errors.push({ line: i + 2, reason: `Falha ao gravar: ${nErr.message}` });
            continue;
          }
          neighborhoodByName = null; // força recarga caso imóveis sejam importados depois
          validRecords++;
        } else {
          // Tipos sem gravação implementada: não contar como importados
          invalidRecords++;
          errors.push({ line: i + 2, reason: 'Importação deste tipo ainda não grava no banco; cadastre pela tela correspondente.' });
        }
      }

      // 3. Atualizar status final do job
      const finalStatus = invalidRecords === totalRecords ? 'FALHA' : 'CONCLUIDO';
      if (jobId) {
        await supabase
          .from('import_jobs')
          .update({
            valid_records: validRecords,
            invalid_records: invalidRecords,
            duplicate_records: duplicateRecords,
            status: finalStatus,
            error_summary: errors.slice(0, 100),
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }

      // 4. Log de auditoria
      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        action: 'DATA_IMPORT_BATCH',
        module: 'administracao',
        entity: 'import_jobs',
        new_data: {
          file_name: fileName,
          entity_type: entityType,
          total: totalRecords,
          valid: validRecords,
          invalid: invalidRecords,
        },
      });

      return {
        success: true,
        job: {
          id: jobId,
          municipality_id: municipalityId,
          entity_type: entityType,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          total_records: totalRecords,
          valid_records: validRecords,
          invalid_records: invalidRecords,
          duplicate_records: duplicateRecords,
          status: finalStatus,
        },
        errors,
      };
    } catch (err: any) {
      console.error('Erro no processamento da importação:', err);
      return {
        success: false,
        job: {
          municipality_id: municipalityId,
          entity_type: entityType,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          total_records: totalRecords,
          valid_records: validRecords,
          invalid_records: invalidRecords,
          duplicate_records: duplicateRecords,
          status: 'FALHA',
        },
        errors: [{ line: 0, reason: err.message || 'Falha geral no servidor.' }],
      };
    }
  },

  // 4. Histórico de import_jobs
  async getRecentJobs(municipalityId: string): Promise<ImportJobRecord[]> {
    try {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erro ao carregar histórico de jobs:', err);
      return [];
    }
  },
};
