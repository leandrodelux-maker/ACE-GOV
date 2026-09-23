import {
  Municipality,
  Neighborhood,
  Property,
  User,
  FieldCycle,
  Ovitrap,
  StrategicPoint,
  EpidemiologicalBlock,
  CitizenComplaint,
  Alert,
  Visit,
} from '../types';

import { supabaseService } from './supabaseService';
import { supabase } from './supabaseClient';

/**
 * Cache local somente-leitura do município da sessão.
 *
 * Guarda cópias de dados do Supabase para uso offline e para telas que
 * precisam de resposta imediata (busca global, contador de alertas). Não é
 * fonte de verdade e não grava dados de negócio: toda gravação vai ao banco
 * pelos serviços. Nada é semeado; sem hidratação, as listas ficam vazias.
 *
 * Versões anteriores semeavam dados de EXEMPLO e tinham métodos que gravavam
 * usuários, denúncias, encaminhamentos e "auditoria" apenas no navegador;
 * esses métodos foram removidos. Os dados de exemplo gravados por versões
 * antigas são apagados na primeira execução (init). A fila offline de visitas
 * do PWA (services/offlineVisitQueue) usa outra chave e não é afetada.
 */

const STORAGE_KEYS = {
  MUNICIPALITY: 'endemias_gov_municipality',
  CURRENT_USER: 'endemias_gov_current_user',
  CYCLE: 'endemias_gov_cycle',
  NEIGHBORHOODS: 'endemias_gov_neighborhoods',
  PROPERTIES: 'endemias_gov_properties',
  VISITS: 'endemias_gov_visits',
  OVITRAPS: 'endemias_gov_ovitraps',
  STRATEGIC_POINTS: 'endemias_gov_strategic_points',
  EPIDEMIOLOGY_BLOCKS: 'endemias_gov_epi_blocks',
  COMPLAINTS: 'endemias_gov_complaints',
  ALERTS: 'endemias_gov_alerts',
};

const STORAGE_SCHEMA_VERSION_KEY = 'endemias_gov_storage_version';
const STORAGE_SCHEMA_VERSION = '2';

/** Chaves de dados municipais (inclui as que recebiam exemplos em versões antigas). */
const MUNICIPAL_KEYS = [
  ...Object.values(STORAGE_KEYS).filter((k) => k !== STORAGE_KEYS.CURRENT_USER),
  'endemias_gov_users',
  'endemias_gov_special_properties',
  'endemias_gov_epi_events',
  'endemias_gov_teams',
  'endemias_gov_supplies',
  'endemias_gov_equipments',
  'endemias_gov_tasks',
  'endemias_gov_referrals',
  'endemias_gov_audit_logs',
];

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Erro ao gravar cache local (${key}):`, err);
  }
}

class EndemiasStorageService {
  /** Remove, uma única vez, os dados de exemplo gravados por versões anteriores. */
  init() {
    try {
      if (localStorage.getItem(STORAGE_SCHEMA_VERSION_KEY) !== STORAGE_SCHEMA_VERSION) {
        for (const key of MUNICIPAL_KEYS) localStorage.removeItem(key);
        localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION);
      }
    } catch {
      /* armazenamento indisponível (ex.: testes em Node) */
    }
  }

  /**
   * Hidrata o cache com dados reais do município da SESSÃO. Listas vazias
   * também são gravadas, para a interface mostrar "sem dados" em vez de restos
   * de outra sessão. Falha de rede mantém o cache anterior (uso offline).
   */
  async hydrateFromSupabase(municipality: Municipality): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !municipality?.id) return;

      saveToStorage(STORAGE_KEYS.MUNICIPALITY, municipality);

      const [neighborhoods, cycle, complaints, alerts, ovitraps, strategicPoints] = await Promise.all([
        supabaseService.getNeighborhoods(municipality.id),
        supabaseService.getActiveCycle(municipality.id),
        supabaseService.getComplaints(municipality.id),
        supabaseService.getAlerts(municipality.id),
        supabaseService.getOvitraps(municipality.id),
        supabaseService.getStrategicPoints(municipality.id),
      ]);

      saveToStorage(STORAGE_KEYS.NEIGHBORHOODS, neighborhoods || []);
      saveToStorage(STORAGE_KEYS.CYCLE, cycle || null);
      saveToStorage(STORAGE_KEYS.COMPLAINTS, complaints || []);
      saveToStorage(STORAGE_KEYS.ALERTS, alerts || []);
      saveToStorage(STORAGE_KEYS.OVITRAPS, ovitraps?.ovitraps || []);
      saveToStorage(STORAGE_KEYS.STRATEGIC_POINTS, strategicPoints || []);
    } catch {
      // Falha de rede: mantém o cache anterior (uso offline)
    }
  }

  /** Remove o cache de dados municipais (logout / troca de sessão). */
  clearMunicipalCache(): void {
    try {
      for (const key of MUNICIPAL_KEYS) localStorage.removeItem(key);
    } catch {
      /* armazenamento indisponível */
    }
  }

  // --- Identidade (cópia para rótulos; a fonte de verdade é o AuthContext) ---
  setSessionUser(user: User | null): void {
    try {
      if (user) saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
      else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {
      /* armazenamento indisponível */
    }
  }

  // --- Município (atualizado ao salvar Configurações > Geral) ---
  getMunicipality(): Municipality | null {
    return getFromStorage<Municipality | null>(STORAGE_KEYS.MUNICIPALITY, null);
  }

  updateMunicipality(updates: Partial<Municipality>): void {
    const current = this.getMunicipality();
    if (!current) return;
    saveToStorage(STORAGE_KEYS.MUNICIPALITY, { ...current, ...updates });
  }

  // --- Leituras do cache ---
  getCycle(): FieldCycle | null {
    return getFromStorage<FieldCycle | null>(STORAGE_KEYS.CYCLE, null);
  }

  getNeighborhoods(): Neighborhood[] {
    return getFromStorage<Neighborhood[]>(STORAGE_KEYS.NEIGHBORHOODS, []);
  }

  getProperties(): Property[] {
    return getFromStorage<Property[]>(STORAGE_KEYS.PROPERTIES, []);
  }

  getVisits(): Visit[] {
    return getFromStorage<Visit[]>(STORAGE_KEYS.VISITS, []);
  }

  getOvitraps(): Ovitrap[] {
    return getFromStorage<Ovitrap[]>(STORAGE_KEYS.OVITRAPS, []);
  }

  getStrategicPoints(): StrategicPoint[] {
    return getFromStorage<StrategicPoint[]>(STORAGE_KEYS.STRATEGIC_POINTS, []);
  }

  getEpidemiologyBlocks(): EpidemiologicalBlock[] {
    return getFromStorage<EpidemiologicalBlock[]>(STORAGE_KEYS.EPIDEMIOLOGY_BLOCKS, []);
  }

  getComplaints(): CitizenComplaint[] {
    return getFromStorage<CitizenComplaint[]>(STORAGE_KEYS.COMPLAINTS, []);
  }

  getAlerts(): Alert[] {
    return getFromStorage<Alert[]>(STORAGE_KEYS.ALERTS, []);
  }
}

export const db = new EndemiasStorageService();
db.init();
