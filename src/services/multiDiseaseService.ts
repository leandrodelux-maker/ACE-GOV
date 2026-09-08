export type DiseaseModuleId =
  | 'arboviroses'
  | 'chagas'
  | 'leishmaniose'
  | 'malaria'
  | 'esquistossomose'
  | 'escorpionismo';

export interface DiseaseModuleConfig {
  id: DiseaseModuleId;
  name: string;
  scientificName?: string;
  vector: string;
  active: boolean;
  surveillanceType: 'entomologica' | 'malacologica' | 'busca_ativa' | 'inquerito_canino' | 'captura_manual';
  commonHabitats: string[];
  fieldActivities: string[];
  icon: string;
  badgeColor: string;
}

export const SUPPORTED_DISEASE_MODULES: DiseaseModuleConfig[] = [
  {
    id: 'arboviroses',
    name: 'Arboviroses Urbanas (Dengue, Zika, Chikungunya)',
    scientificName: 'Aedes aegypti / Aedes albopictus',
    vector: 'Mosquito Aedes',
    active: true,
    surveillanceType: 'entomologica',
    commonHabitats: ['Pneus', 'Caixas d’água destampadas', 'Vasos e pratinhos', 'Piscinas desativadas'],
    fieldActivities: ['Visita Domiciliar', 'LIRAa / LIA', 'Instalação de Ovitrampas', 'Bloqueio Químico'],
    icon: 'Bug',
    badgeColor: 'emerald'
  },
  {
    id: 'chagas',
    name: 'Doença de Chagas (Triatomíneos)',
    scientificName: 'Triatoma infestans / Panstrongylus megistus',
    vector: 'Barbeiro / Bicho-de-parede',
    active: false,
    surveillanceType: 'captura_manual',
    commonHabitats: ['Frestas de taipa e pau-a-pique', 'Galinheiros', 'Pilhas de telhas e lenha peridomiciliar'],
    fieldActivities: ['Pesquisa Triatomínea Integral', 'Borrifação Residual Intradomiciliar', 'Instalação de PIT (Postos de Informação)'],
    icon: 'ShieldAlert',
    badgeColor: 'amber'
  },
  {
    id: 'leishmaniose',
    name: 'Leishmanioses (Visceral e Tegumentar)',
    scientificName: 'Lutzomyia longipalpis (Mosquito-palha)',
    vector: 'Flebotomíneo / Mosquito-palha',
    active: false,
    surveillanceType: 'inquerito_canino',
    commonHabitats: ['Matéria orgânica em decomposição', 'Abrigos de animais', 'Chiqueiros e galinheiros sombreados'],
    fieldActivities: ['Armadilha Luminosa CDC', 'Inquérito Sorológico Canino', 'Encoleiramento com Deltametrina', 'Manejo Ambiental'],
    icon: 'Activity',
    badgeColor: 'violet'
  },
  {
    id: 'malaria',
    name: 'Malária (Anofelinos)',
    scientificName: 'Anopheles darlingi',
    vector: 'Mosquito-prego / Anopheles',
    active: false,
    surveillanceType: 'busca_ativa',
    commonHabitats: ['Igarapés sombreados', 'Margens de rios lentos', 'Represas com vegetação aquática'],
    fieldActivities: ['Busca Ativa de Febris', 'Coleta de Gota Espessa', 'Borrifação Intradomiciliar de Efeito Residual (BIER)'],
    icon: 'Flame',
    badgeColor: 'rose'
  },
  {
    id: 'esquistossomose',
    name: 'Esquistossomose Mansônica (Malacologia)',
    scientificName: 'Biomphalaria glabrata / straminea',
    vector: 'Caramujo de água doce',
    active: false,
    surveillanceType: 'malacologica',
    commonHabitats: ['Córregos peridomiciliares', 'Valas de irrigação', 'Lagoas e açudes com macrófitas'],
    fieldActivities: ['Coleta Malacológica Sistemática', 'Inquérito Coproscópico Kato-Katz', 'Tratamento Químico de Criadouros'],
    icon: 'Waves',
    badgeColor: 'cyan'
  },
  {
    id: 'escorpionismo',
    name: 'Escorpionismo e Animais Peçonhentos',
    scientificName: 'Tityus serrulatus / Tityus bahiensis',
    vector: 'Escorpião-amarelo',
    active: false,
    surveillanceType: 'busca_ativa',
    commonHabitats: ['Redes de esgoto e galerias pluviais', 'Entulhos de construção', 'Cemitérios e lixões'],
    fieldActivities: ['Busca Ativa Noturna com Luz Ultravioleta', 'Vedação de Ralos e Caixas de Passagem', 'Remoção de Entulho e Baratas'],
    icon: 'Radio',
    badgeColor: 'orange'
  }
];

export const multiDiseaseService = {
  /**
   * Obtém módulos de endemias configurados para o município (armazenados em localStorage ou settings municipais)
   */
  getEnabledModules(municipalityId: string): DiseaseModuleConfig[] {
    const key = `endemias_gov_modules_${municipalityId}`;
    const saved = localStorage.getItem(key);
    if (!saved) {
      return SUPPORTED_DISEASE_MODULES;
    }
    try {
      const activeIds: string[] = JSON.parse(saved);
      return SUPPORTED_DISEASE_MODULES.map(m => ({
        ...m,
        active: activeIds.includes(m.id)
      }));
    } catch {
      return SUPPORTED_DISEASE_MODULES;
    }
  },

  /**
   * Salva os módulos de endemias ativos para o município
   */
  saveEnabledModules(municipalityId: string, activeIds: DiseaseModuleId[]): void {
    const key = `endemias_gov_modules_${municipalityId}`;
    localStorage.setItem(key, JSON.stringify(activeIds));
  }
};
