import QRCode from 'qrcode';
import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { AGENT_EMBED, agentName, formatAddress } from './schemaHelpers';
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
   * Cria a URI do QR Code no domínio onde o sistema está publicado
   */
  generateQrUrl(entityType: QrEntityType, entityId: string, entityCode: string): string {
    const token = this.generateSecureToken(entityType, entityId);
    return `${window.location.origin}/qr?t=${entityType}&id=${entityId}&c=${encodeURIComponent(entityCode)}&tk=${token}`;
  },

  /**
   * Gera a imagem do QR Code no próprio navegador (SVG em data URI), sem enviar
   * identificadores a serviços externos e funcionando offline.
   */
  getQrCodeImageUrl(content: string, size = 200): string {
    const { modules } = QRCode.create(content, { errorCorrectionLevel: 'M' });
    const margin = 2;
    const count = modules.size + margin * 2;
    let path = '';
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges">` +
      `<rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  },

  /**
   * Decodifica a URL ou payload de um QR escaneado.
   * Aceita etiquetas de qualquer domínio com caminho /qr (inclusive as antigas
   * impressas com endemias.gov.br).
   */
  parseQrPayload(qrText: string): QrPayloadData | null {
    try {
      if (/^https?:\/\/[^/]+\/qr\?/i.test(qrText.trim())) {
        const url = new URL(qrText.trim());
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
      await auditLogService.log({
        municipalityId: requireMunicipalityId(config.municipalityId),
        action: 'GERAR_ETIQUETAS',
        module: 'etiquetas',
        entity: 'etiquetas_qrcode',
        newData: { descricao: `Geração de ${config.quantity} etiquetas de QR Code (${config.entityType}) no formato ${config.format} por ${config.userName || 'Usuário Autenticado'}.` },
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
              code: data.property_code || `IMO-${data.id.substring(0, 6)}`,
              address: data.street,
              number: data.number,
              neighborhood: data.neighborhoods?.name,
              type: data.property_type,
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
                eggs_count,
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
              location: data.address || data.reference_point,
              status: data.status,
              installedAt: data.last_installation_date,
              nextCollection: data.next_collection_date,
              lastCollectionDate: latest?.collection_date,
              lastEggs: latest?.eggs_count,
            },
          };
        }

        case 'strategic_point': {
          const { data, error } = await supabase
            .from('strategic_points')
            .select(`
              *,
              properties(street, number),
              strategic_point_inspections (
                id,
                inspection_date,
                positive_deposits,
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
              code: `PE-${data.id.substring(0, 4).toUpperCase()}`,
              name: data.name,
              type: data.category,
              address: formatAddress(data.properties),
              lastInspection: inspections[0]?.inspection_date || data.last_inspection || 'Não realizada',
              nextInspection: data.next_inspection,
              inspectionsCount: inspections.length,
            },
          };
        }

        case 'special_property': {
          const { data, error } = await supabase
            .from('special_properties')
            .select('*, properties(street, number)')
            .eq('id', id)
            .single();
          if (error) throw error;
          return {
            type: 'special_property',
            data: {
              id: data.id,
              code: `IE-${data.id.substring(0, 4).toUpperCase()}`,
              name: data.name,
              category: data.category,
              address: formatAddress(data.properties),
              contactName: undefined,
            },
          };
        }

        case 'sample': {
          const { data, error } = await supabase
            .from('entomological_samples')
            .select(`
              *,
              properties(street, number),
              agents(${AGENT_EMBED}),
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
              agentName: agentName(data.agents),
              address: formatAddress(data.properties),
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
              agents:assigned_to_agent_id (${AGENT_EMBED})
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
              assignedAgent: agentName(data.agents) || 'Sem responsável atribuído',
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
