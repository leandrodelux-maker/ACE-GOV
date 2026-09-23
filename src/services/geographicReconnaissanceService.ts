import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

export interface PropertyRG {
  id: string;
  municipality_id: string;
  property_code: string;
  property_type: string;
  situation: 'ativo' | 'inativo' | 'demolido';
  street: string;
  number: string;
  complement?: string;
  reference?: string;
  postal_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  residents_count?: number;
  resident_name?: string;
  resident_phone?: string;
  neighborhood_id?: string;
  zone_id?: string;
  sector_id?: string;
  microarea_id?: string;
  block_id?: string;
  assigned_agent_id?: string | null;
  last_cadastral_update?: string;
  last_visit_at?: string;
  status?: string;
  risk_score?: number;
  // Relacionamentos carregados
  neighborhood?: { id: string; name: string };
  sector?: { id: string; name: string; code: string };
  microarea?: { id: string; code: string };
  block?: { id: string; code: string; block_number?: string };
  assigned_agent?: { id: string; name: string; registry?: string };
}

export interface RGIndicators {
  totalProperties: number;
  georeferencedProperties: number;
  georeferencedPercentage: number;
  propertiesWithoutSector: number;
  propertiesWithoutAgent: number;
  outdatedProperties: number; // Sem atualização há mais de 60 dias
}

export interface RGCadastralAnomaly {
  type: 'DUPLICATE_CODE' | 'INCOMPLETE_ADDRESS' | 'NO_COORDINATES' | 'BLOCK_WITHOUT_PROPERTIES' | 'MICROAREA_WITHOUT_AGENT';
  severity: 'alta' | 'media' | 'baixa';
  title: string;
  description: string;
  count: number;
  items: any[];
}


export const geographicReconnaissanceService = {
  // 1. Carregar indicadores reais do Reconhecimento Geográfico
  async getIndicators(municipalityId: string): Promise<RGIndicators> {
    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('id, latitude, longitude, sector_id, assigned_agent_id, last_cadastral_update, created_at, situation')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);

      if (error) throw error;
      const props = properties || [];
      const total = props.length;

      const georeferenced = props.filter(p => p.latitude != null && p.longitude != null).length;
      const withoutSector = props.filter(p => !p.sector_id).length;
      const withoutAgent = props.filter(p => !p.assigned_agent_id).length;

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const outdated = props.filter(p => {
        const updateDate = p.last_cadastral_update ? new Date(p.last_cadastral_update) : new Date(p.created_at);
        return updateDate < sixtyDaysAgo;
      }).length;

      return {
        totalProperties: total,
        georeferencedProperties: georeferenced,
        georeferencedPercentage: total > 0 ? Number(((georeferenced / total) * 100).toFixed(1)) : 0,
        propertiesWithoutSector: withoutSector,
        propertiesWithoutAgent: withoutAgent,
        outdatedProperties: outdated,
      };
    } catch (err) {
      console.error('Erro ao calcular indicadores de RG:', err);
      return {
        totalProperties: 0,
        georeferencedProperties: 0,
        georeferencedPercentage: 0,
        propertiesWithoutSector: 0,
        propertiesWithoutAgent: 0,
        outdatedProperties: 0,
      };
    }
  },

  // 2. Listar imóveis com filtros territoriais completos
  async getProperties(params: {
    municipalityId: string;
    neighborhoodId?: string;
    sectorId?: string;
    microareaId?: string;
    blockId?: string;
    agentId?: string;
    situation?: string;
    propertyType?: string;
    search?: string;
    onlyWithoutCoords?: boolean;
    limit?: number;
  }): Promise<PropertyRG[]> {
    try {
      const munId = requireMunicipalityId(params.municipalityId);
      let query = supabase
        .from('properties')
        .select(`
          *,
          neighborhood:neighborhoods(id, name),
          sector:sectors(id, name, code),
          microarea:microareas(id, code),
          block:blocks(id, code, block_number),
          assigned_agent:agents(id, name, registry)
        `)
        .eq('municipality_id', munId)
        .is('deleted_at', null)
        .order('street', { ascending: true })
        .limit(params.limit || 200);

      if (params.neighborhoodId) query = query.eq('neighborhood_id', params.neighborhoodId);
      if (params.sectorId) query = query.eq('sector_id', params.sectorId);
      if (params.microareaId) query = query.eq('microarea_id', params.microareaId);
      if (params.blockId) query = query.eq('block_id', params.blockId);
      if (params.agentId) query = query.eq('assigned_agent_id', params.agentId);
      if (params.situation) query = query.eq('situation', params.situation);
      if (params.propertyType) query = query.eq('property_type', params.propertyType);
      if (params.onlyWithoutCoords) query = query.is('latitude', null);

      if (params.search && params.search.trim() !== '') {
        const term = `%${params.search.trim()}%`;
        query = query.or(`property_code.ilike.${term},street.ilike.${term},resident_name.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as PropertyRG[]) || [];
    } catch (err) {
      console.error('Erro ao buscar imóveis do RG:', err);
      return [];
    }
  },

  // 3. Ferramenta de Detecção de Anomalias Cadastrais
  async detectCadastralAnomalies(municipalityId: string): Promise<RGCadastralAnomaly[]> {
    try {
      const anomalies: RGCadastralAnomaly[] = [];

      // A. Imóveis com coordenadas ausentes
      const { data: withoutCoords } = await supabase
        .from('properties')
        .select('id, property_code, street, number, neighborhood_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .is('latitude', null)
        .limit(100);

      if (withoutCoords && withoutCoords.length > 0) {
        anomalies.push({
          type: 'NO_COORDINATES',
          severity: 'alta',
          title: 'Imóveis sem coordenadas GPS',
          description: `${withoutCoords.length} imóveis ainda não possuem latitude e longitude mapeadas.`,
          count: withoutCoords.length,
          items: withoutCoords,
        });
      }

      // B. Endereços incompletos (sem logradouro ou sem número)
      const { data: incompleteAddr } = await supabase
        .from('properties')
        .select('id, property_code, street, number')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .or('street.is.null,number.is.null,street.eq."",number.eq.""')
        .limit(100);

      if (incompleteAddr && incompleteAddr.length > 0) {
        anomalies.push({
          type: 'INCOMPLETE_ADDRESS',
          severity: 'alta',
          title: 'Endereços incompletos',
          description: `${incompleteAddr.length} imóveis cadastrados sem nome de logradouro ou número de porta.`,
          count: incompleteAddr.length,
          items: incompleteAddr,
        });
      }

      // C. Códigos de imóvel duplicados
      const { data: allProps } = await supabase
        .from('properties')
        .select('id, property_code, street, number, block_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);

      if (allProps) {
        const codeMap: Record<string, any[]> = {};
        allProps.forEach(p => {
          if (p.property_code) {
            codeMap[p.property_code] = codeMap[p.property_code] || [];
            codeMap[p.property_code].push(p);
          }
        });

        const duplicates = Object.entries(codeMap)
          .filter(([_, list]) => list.length > 1)
          .flatMap(([_, list]) => list);

        if (duplicates.length > 0) {
          anomalies.push({
            type: 'DUPLICATE_CODE',
            severity: 'alta',
            title: 'Duplicidade de Código de Imóvel',
            description: `${duplicates.length} registros compartilham o mesmo código de imóvel no município.`,
            count: duplicates.length,
            items: duplicates,
          });
        }
      }

      // D. Quadras sem nenhum imóvel cadastrado
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, code, block_number, sector_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null);

      if (blocks && allProps) {
        const occupiedBlockIds = new Set(allProps.map(p => p.block_id).filter(Boolean));
        const emptyBlocks = blocks.filter(b => !occupiedBlockIds.has(b.id));

        if (emptyBlocks.length > 0) {
          anomalies.push({
            type: 'BLOCK_WITHOUT_PROPERTIES',
            severity: 'media',
            title: 'Quadras sem imóveis cadastrados',
            description: `${emptyBlocks.length} quadras geográficas não possuem nenhum imóvel vinculado.`,
            count: emptyBlocks.length,
            items: emptyBlocks,
          });
        }
      }

      // E. Microáreas sem ACE responsável
      const { data: microareas } = await supabase
        .from('microareas')
        .select('id, code, sector_id, assigned_agent_id')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .is('assigned_agent_id', null);

      if (microareas && microareas.length > 0) {
        anomalies.push({
          type: 'MICROAREA_WITHOUT_AGENT',
          severity: 'alta',
          title: 'Microáreas sem ACE designado',
          description: `${microareas.length} microáreas estão desprovidas de Agente de Combate às Endemias titular.`,
          count: microareas.length,
          items: microareas,
        });
      }

      return anomalies;
    } catch (err) {
      console.error('Erro ao diagnosticar anomalias cadastrais:', err);
      return [];
    }
  },

  // 4. Cadastrar novo Imóvel no Reconhecimento Geográfico
  async createProperty(property: Partial<PropertyRG>): Promise<{ success: boolean; property?: PropertyRG; message: string }> {
    try {
      const munId = requireMunicipalityId(property.municipality_id);

      // Gerar código único caso não fornecido
      let code = property.property_code;
      if (!code || code.trim() === '') {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        code = `IMO-${new Date().getFullYear()}-${randomNum}`;
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({
          municipality_id: munId,
          property_code: code,
          property_type: property.property_type || 'residencia',
          situation: property.situation || 'ativo',
          street: property.street,
          number: property.number,
          complement: property.complement,
          reference: property.reference,
          postal_code: property.postal_code,
          latitude: property.latitude,
          longitude: property.longitude,
          residents_count: property.residents_count || 1,
          resident_name: property.resident_name,
          resident_phone: property.resident_phone,
          neighborhood_id: property.neighborhood_id,
          sector_id: property.sector_id,
          microarea_id: property.microarea_id,
          block_id: property.block_id,
          assigned_agent_id: property.assigned_agent_id,
          last_cadastral_update: new Date().toISOString(),
          status: 'cadastrado',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, property: data, message: 'Imóvel cadastrado com sucesso no RG!' };
    } catch (err: any) {
      console.error('Erro ao cadastrar imóvel no RG:', err);
      return { success: false, message: err.message || 'Falha ao cadastrar imóvel.' };
    }
  },

  // 5. Atualizar Imóvel (Edição geral ou atualização cadastral em campo)
  async updateProperty(id: string, updates: Partial<PropertyRG>): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          ...updates,
          last_cadastral_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true, message: 'Cadastro de imóvel atualizado com sucesso!' };
    } catch (err: any) {
      console.error('Erro ao atualizar imóvel:', err);
      return { success: false, message: err.message || 'Falha ao atualizar imóvel.' };
    }
  },

  // 6. Transferir Imóvel de Setor
  async transferSector(propertyId: string, newSectorId: string, newMicroareaId?: string, newBlockId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          sector_id: newSectorId,
          microarea_id: newMicroareaId || null,
          block_id: newBlockId || null,
          last_cadastral_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (error) throw error;
      return { success: true, message: 'Imóvel transferido de setor com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao transferir setor.' };
    }
  },

  // 7. Transferir Imóvel de ACE responsável
  async transferAgent(propertyId: string, newAgentId: string | null): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          assigned_agent_id: newAgentId,
          last_cadastral_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (error) throw error;
      return { success: true, message: 'ACE responsável atualizado com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao transferir ACE.' };
    }
  },

  // 8. Inativar ou Reativar Imóvel
  async setSituation(propertyId: string, situation: 'ativo' | 'inativo' | 'demolido'): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          situation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (error) throw error;
      return { success: true, message: `Situação do imóvel alterada para "${situation}".` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao alterar situação do imóvel.' };
    }
  },

  // 9. Georreferenciar Imóvel
  async setGeoreference(propertyId: string, latitude: number, longitude: number): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          latitude,
          longitude,
          last_cadastral_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (error) throw error;
      return { success: true, message: 'Georreferenciamento fixado com sucesso!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha ao georreferenciar imóvel.' };
    }
  },

  // 10. Listar opções territoriais auxiliares para seletores
  async getTerritoryOptions(municipalityId: string) {
    try {
      const [bairros, setores, microareas, quadras, agentes] = await Promise.all([
        supabase.from('neighborhoods').select('id, name').eq('municipality_id', municipalityId).order('name'),
        supabase.from('sectors').select('id, name, code, neighborhood_id').eq('municipality_id', municipalityId).order('code'),
        supabase.from('microareas').select('id, code, sector_id').eq('municipality_id', municipalityId).order('code'),
        supabase.from('blocks').select('id, code, block_number, sector_id').eq('municipality_id', municipalityId).order('code'),
        supabase.from('agents').select('id, name, registry').eq('municipality_id', municipalityId).order('name'),
      ]);

      return {
        neighborhoods: bairros.data || [],
        sectors: setores.data || [],
        microareas: microareas.data || [],
        blocks: quadras.data || [],
        agents: agentes.data || [],
      };
    } catch (err) {
      console.error('Erro ao buscar opções territoriais:', err);
      return { neighborhoods: [], sectors: [], microareas: [], blocks: [], agents: [] };
    }
  },
};
