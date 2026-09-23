import { supabase } from './supabaseClient';

export interface ColumnMapping {
  notificationNumber: string;
  disease: string;
  notificationDate: string;
  symptomsDate: string;
  neighborhood: string;
  approximateAddress: string;
  classification: string;
  labResult: string;
  status: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  validRows: any[];
  errors: Array<{ row: number; error: string }>;
}

export interface ImportExecutionResult {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  ignoredDuplicates: number;
  errorCount: number;
  jobId?: string;
  logSummary: string;
}


export const epidemiologyImportService = {
  /**
   * Identifica automaticamente as colunas mais prováveis com base nos nomes oficiais do SINAN e e-SUS
   */
  detectDefaultMapping(headers: string[]): ColumnMapping {
    const findMatch = (patterns: string[]): string => {
      for (const pattern of patterns) {
        const found = headers.find(h =>
          h.toLowerCase().trim().replace(/[^a-z0-9]/g, '').includes(pattern.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
        if (found) return found;
      }
      return '';
    };

    return {
      notificationNumber: findMatch(['notificacao', 'num_notif', 'nu_notif', 'numero_notif', 'protocolo', 'id_notif']),
      disease: findMatch(['doenca', 'agravo', 'cid10', 'patologia', 'tipo_caso']),
      notificationDate: findMatch(['dt_notific', 'data_notif', 'dt_notif', 'data_notificacao', 'dt_not']),
      symptomsDate: findMatch(['dt_sin_pri', 'dt_sintomas', 'data_sintomas', 'data_inicio', 'dt_inicio']),
      neighborhood: findMatch(['bairro', 'nm_bairro', 'id_bairro', 'distrito']),
      approximateAddress: findMatch(['endereco', 'logradouro', 'rua', 'nm_logrado', 'local']),
      classification: findMatch(['classi_fin', 'classificacao', 'tipo_confirmacao', 'criterio']),
      labResult: findMatch(['res_chiku', 'res_dengue', 'resultado', 'laudo', 'lab_resultado']),
      status: findMatch(['situacao', 'status', 'encerramento', 'evolucao']),
    };
  },

  /**
   * Parse simples e resiliente de arquivos CSV/Texto
   */
  parseCSV(content: string, delimiter = ','): { headers: string[]; rows: string[][] } {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Tentar detectar delimitador (; ou ,)
    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const actualDelimiter = semiCount > commaCount ? ';' : delimiter;

    const parseLine = (line: string) => {
      const result: string[] = [];
      let inQuotes = false;
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === actualDelimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => parseLine(line));

    return { headers, rows };
  },

  /**
   * Validação, Sanitização LGPD e Identificação de Duplicidades antes da gravação
   */
  async validateAndPreview(
    rows: string[][],
    headers: string[],
    mapping: ColumnMapping,
    municipalityId: string
  ): Promise<ImportPreviewResult> {
    const colIndex = (colName: string) => headers.indexOf(colName);

    const idxNum = colIndex(mapping.notificationNumber);
    const idxDisease = colIndex(mapping.disease);
    const idxNotifDate = colIndex(mapping.notificationDate);
    const idxSymptomsDate = colIndex(mapping.symptomsDate);
    const idxNeigh = colIndex(mapping.neighborhood);
    const idxAddress = colIndex(mapping.approximateAddress);
    const idxClass = colIndex(mapping.classification);
    const idxResult = colIndex(mapping.labResult);
    const idxStatus = colIndex(mapping.status);

    // Buscar números de notificação já existentes no banco do município para evitar duplicação
    const { data: existingCases } = await supabase
      .from('epidemiological_cases')
      .select('id, case_number')
      .eq('municipality_id', municipalityId);

    const existingMap = new Map<string, string>();
    (existingCases || []).forEach((c: any) => {
      if (c.case_number) existingMap.set(c.case_number.trim().toUpperCase(), c.id);
    });

    let newRecords = 0;
    let updatedRecords = 0;
    let duplicateRecords = 0;
    let errorRecords = 0;
    const validRows: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    const seenInFile = new Set<string>();

    rows.forEach((row, i) => {
      const rowNumber = i + 2; // Linha 1 é o cabeçalho
      if (row.length === 0 || (row.length === 1 && !row[0])) return;

      const notifNumber = idxNum >= 0 && row[idxNum] ? row[idxNum].trim().toUpperCase() : `NOTIF-TEMP-${rowNumber}`;
      const diseaseRaw = idxDisease >= 0 && row[idxDisease] ? row[idxDisease].trim() : 'Dengue';
      const notifDateRaw = idxNotifDate >= 0 && row[idxNotifDate] ? row[idxNotifDate].trim() : new Date().toISOString().split('T')[0];

      // Sanitização básica de doença
      let diseaseNormalized = 'Dengue';
      const dLower = diseaseRaw.toLowerCase();
      if (dLower.includes('chiku')) diseaseNormalized = 'Chikungunya';
      else if (dLower.includes('zika')) diseaseNormalized = 'Zika';
      else if (dLower.includes('febre amarela')) diseaseNormalized = 'Febre Amarela';
      else if (dLower.includes('chagas')) diseaseNormalized = 'Doença de Chagas';
      else if (dLower.includes('leish')) diseaseNormalized = 'Leishmaniose';
      else if (dLower.includes('malaria') || dLower.includes('malária')) diseaseNormalized = 'Malária';

      // Sanitização de data
      let formattedDate = notifDateRaw;
      if (notifDateRaw.includes('/')) {
        const parts = notifDateRaw.split('/');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Checagem de duplicação interna no próprio arquivo
      if (seenInFile.has(notifNumber)) {
        duplicateRecords++;
        return;
      }
      seenInFile.add(notifNumber);

      // Checar se já existe no banco
      const existingId = existingMap.get(notifNumber);
      if (existingId) {
        updatedRecords++;
      } else {
        newRecords++;
      }

      // Higienização LGPD: Não carregar colunas de CPF, Nome pessoal ou telefone
      validRows.push({
        id: existingId || undefined,
        case_number: notifNumber,
        disease: diseaseNormalized,
        notification_date: formattedDate,
        symptoms_date: idxSymptomsDate >= 0 && row[idxSymptomsDate] ? row[idxSymptomsDate] : undefined,
        neighborhood_name: idxNeigh >= 0 && row[idxNeigh] ? row[idxNeigh] : 'Não Informado',
        approximate_address: idxAddress >= 0 && row[idxAddress] ? row[idxAddress] : undefined,
        classification: idxClass >= 0 && row[idxClass] ? row[idxClass] : 'EM_INVESTIGACAO',
        laboratory_result: idxResult >= 0 && row[idxResult] ? row[idxResult] : 'EM_ANALISE',
        status: idxStatus >= 0 && row[idxStatus] ? row[idxStatus] : 'NOTIFICADO',
      });
    });

    return {
      totalRows: rows.length,
      newRecords,
      updatedRecords,
      duplicateRecords,
      errorRecords,
      validRows,
      errors,
    };
  },

  /**
   * Executa a carga efetiva no Supabase e registra log de importação auditável
   */
  async executeImport(
    validRows: any[],
    fileName: string,
    municipalityId: string
  ): Promise<ImportExecutionResult> {
    try {
      let importedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const row of validRows) {
        try {
          if (row.id) {
            // Atualização de registro existente
            await supabase
              .from('epidemiological_cases')
              .update({
                disease: row.disease,
                notification_date: row.notification_date,
                classification: row.classification,
                laboratory_result: row.laboratory_result,
                status: row.status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            updatedCount++;
          } else {
            // Inserção de novo caso
            await supabase.from('epidemiological_cases').insert({
              municipality_id: municipalityId,
              case_number: row.case_number,
              disease: row.disease,
              notification_date: row.notification_date,
              classification: row.classification,
              laboratory_result: row.laboratory_result,
              status: row.status,
            });
            importedCount++;
          }
        } catch {
          errorCount++;
        }
      }

      // Registrar auditoria e job de importação
      const summary = `Importação de dados epidemiológicos concluída: ${importedCount} novos, ${updatedCount} atualizados, ${errorCount} falhas. Arquivo: ${fileName}.`;

      await supabase.from('audit_logs').insert({
        municipality_id: municipalityId,
        entity_name: 'epidemiological_cases',
        action: 'IMPORTACAO_EPIDEMIOLOGICA',
        details: summary,
      });

      return {
        success: true,
        importedCount,
        updatedCount,
        ignoredDuplicates: 0,
        errorCount,
        logSummary: summary,
      };
    } catch (err: any) {
      console.error('Erro na importação epidemiológica:', err);
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        ignoredDuplicates: 0,
        errorCount: validRows.length,
        logSummary: `Falha crítica na importação: ${err.message}`,
      };
    }
  },
};
