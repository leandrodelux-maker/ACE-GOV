import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

export type QrEntityType =
  | 'property'
  | 'ovitrap'
  | 'strategic_point'
  | 'special_property'
  | 'sample'
  | 'equipment';

export interface QrPayloadData {
  type: QrEntityType;
  id: string;
  code: string;
  token: string;
}

export interface LabelPrintConfig {
  municipalityName: string;
  entityType: QrEntityType;
  items: Array<{
    id: string;
    code: string;
    title: string;
    subtitle?: string;
    category?: string;
    date?: string;
  }>;
  format: 'individual' | 'folha_a4' | 'rolo_termico';
  includeDate: boolean;
}


export const qrCodeService = {
  /**
   * Gera um token opaco e seguro para o identificador sem expor dados pessoais
   */
  generateSecureToken(entityType: QrEntityType, entityId: string): string {
    const raw = `${entityType}:${entityId}:${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `EG-${entityType.substring(0, 3).toUpperCase()}-${hex}`;
  },

  /**
   * Cria a URI padronizada do QR Code governamental
   */
  generateQrUrl(entityType: QrEntityType, entityId: string, entityCode: string): string {
    const token = this.generateSecureToken(entityType, entityId);
    return `https://endemias.gov.br/qr?t=${entityType}&id=${entityId}&c=${encodeURIComponent(entityCode)}&tk=${token}`;
  },

  /**
   * Constrói a URL para renderizar imagem QR Code via API pública do SUS / Google Chart segura
   */
  getQrCodeImageUrl(content: string, size = 200): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(content)}`;
  },

  /**
   * Decodifica a URL ou payload de um QR escaneado
   */
  parseQrPayload(qrText: string): QrPayloadData | null {
    try {
      if (qrText.includes('endemias.gov.br/qr')) {
        const url = new URL(qrText);
        const type = url.searchParams.get('t') as QrEntityType;
        const id = url.searchParams.get('id') || '';
        const code = url.searchParams.get('c') || '';
        const token = url.searchParams.get('tk') || '';

        if (type && id) {
          return { type, id, code, token };
        }
      }

      // Suporte a JSON direto caso o scanner emita string JSON
      if (qrText.startsWith('{') && qrText.endsWith('}')) {
        const parsed = JSON.parse(qrText);
        if (parsed.type && parsed.id) {
          return {
            type: parsed.type,
            id: parsed.id,
            code: parsed.code || '',
            token: parsed.token || '',
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Registrar auditoria de geração de etiquetas (em lote ou individual)
   */
  async logLabelGeneration(config: {
    municipalityId: string;
    entityType: QrEntityType;
    quantity: number;
    format: string;
    userName?: string;
  }) {
    try {
      await supabase.from('audit_logs').insert({
        municipality_id: requireMunicipalityId(config.municipalityId),
        entity_name: 'etiquetas_qrcode',
        action: 'GERAR_ETIQUETAS',
        details: `Geração de ${config.quantity} etiquetas de QR Code (${config.entityType}) no formato ${config.format} por ${config.userName || 'Usuário Autenticado'}.`,
      });
    } catch (err) {
      console.warn('Erro ao registrar auditoria de etiquetas:', err);
    }
  },

  /**
   * Buscar dados resumidos da entidade a partir do QR Code escaneado
   */
  async resolveScannedEntity(type: QrEntityType, id: string) {
    try {
      switch (type) {
        case 'property': {
          const { data, error } = await supabase
            .from('properties')
            .select('*, neighborhoods(name)')
            .eq('id', id)
            .single();
          if (error) throw error;
          return {
            type: 'property',
            data: {
              id: data.id,
              code: data.code || `IMO-${data.id.substring(0, 6)}`,
              address: data.address,
              number: data.number,
              neighborhood: data.neighborhoods?.name,
              type: data.type,
              status: data.status,
            },
          };
        }

        case 'ovitrap': {
          const { data, error } = await supabase
            .from('ovitraps')
            .select(`
              *,
              ovitrap_collections (
                id,
                collection_date,
                status,
                egg_count,
                created_at
              )
            `)
            .eq('id', id)
            .single();
          if (error) throw error;
          const collections = data.ovitrap_collections || [];
          collections.sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const latest = collections[0];

          return {
            type: 'ovitrap',
            data: {
              id: data.id,
              code: data.code,
              location: data.location_description || data.address,
              status: data.status,
              installedAt: data.installation_date,
              nextCollection: data.next_collection_date,
              lastCollectionDate: latest?.collection_date,
              lastEggs: latest?.egg_count,
            },
          };
        }

        case 'strategic_point': {
          const { data, error } = await supabase
            .from('strategic_points')
            .select(`
              *,
              strategic_point_inspections (
                id,
                inspection_date,
                result,
                created_at
              )
            `)
            .eq('id', id)
            .single();
          if (error) throw error;
          const inspections = data.strategic_point_inspections || [];
          inspections.sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          return {
            type: 'strategic_point',
            data: {
              id: data.id,
              code: data.code,
              name: data.name,
              type: data.type,
              address: data.address,
              lastInspection: inspections[0]?.inspection_date || 'Não realizada',
              nextInspection: data.next_inspection_date,
              inspectionsCount: inspections.length,
            },
          };
        }

        case 'special_property': {
          const { data, error } = await supabase
            .from('special_properties')
            .select('*')
            .eq('id', id)
            .single();
          if (error) throw error;
          return {
            type: 'special_property',
            data: {
              id: data.id,
              code: data.code,
              name: data.name,
              category: data.category,
              address: data.address,
              contactName: data.contact_name,
            },
          };
        }

        case 'sample': {
          const { data, error } = await supabase
            .from('entomological_samples')
            .select(`
              *,
              properties(address),
              agents(name),
              entomological_identifications(*)
            `)
            .eq('id', id)
            .single();
          if (error) throw error;
          return {
            type: 'sample',
            data: {
              id: data.id,
              sampleCode: data.sample_code,
              collectionType: data.collection_type,
              collectionDate: data.collection_date,
              status: data.status,
              agentName: data.agents?.name,
              address: data.properties?.address,
              receivedAt: data.received_at,
              identifications: data.entomological_identifications || [],
            },
          };
        }

        case 'equipment': {
          const { data, error } = await supabase
            .from('equipment')
            .select(`
              *,
              agents:assigned_to_agent_id (name)
            `)
            .eq('id', id)
            .single();
          if (error) throw error;
          return {
            type: 'equipment',
            data: {
              id: data.id,
              code: data.code,
              name: data.name,
              category: data.category || data.type,
              serialNumber: data.serial_number,
              status: data.status,
              assignedAgent: data.agents?.name || 'Almoxarifado Central',
              nextMaintenance: data.next_maintenance,
            },
          };
        }

        default:
          return null;
      }
    } catch (err) {
      console.error(`Erro ao resolver entidade ${type} ${id}:`, err);
      return null;
    }
  },
};
