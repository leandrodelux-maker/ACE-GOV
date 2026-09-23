/**
 * Endemias GOV - Tipos e Interfaces do Sistema
 * Plataforma Municipal de Inteligência e Controle de Endemias
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'MUNICIPAL_ADMIN'
  | 'HEALTH_SECRETARY'
  | 'ENDEMIAS_COORDINATOR'
  | 'FIELD_SUPERVISOR'
  | 'ACE'
  | 'EPIDEMIOLOGY_AGENT'
  | 'SANITARY_AGENT'
  | 'PRIMARY_CARE_ACS'
  | 'AUDITOR_VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  registrationNumber: string; // Matrícula
  role: UserRole;
  municipalityId: string;
  departmentId?: string;
  teamId?: string;
  phone?: string;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Municipality {
  id: string;
  name: string;
  state: string; // UF
  ibgeCode: string;
  coatOfArmsUrl?: string;
  healthSecretaryName: string;
  healthSecretaryPhone: string;
  coordinatorName: string;
  coordinatorPhone: string;
  address: string;
  activeCycleId?: string;
  totalProperties: number;
  totalAgents: number;
  totalSupervisors: number;
  settings: {
    riskWeights: {
      recentFoci: number;
      recurrence: number;
      ovitraps: number;
      pendingVisits: number;
      closedProperties: number;
      complaints: number;
      strategicPoints: number;
      epidemiologicalEvents: number;
      lowCoverage: number;
    };
    recurrenceThresholdDays: number;
    recurrenceThresholdCount: number;
  };
}

export type ZoneType = 'URBANA' | 'RURAL' | 'DISTRITO' | 'POVOADO';

export interface Zone {
  id: string;
  municipalityId: string;
  name: string;
  type: ZoneType;
  description?: string;
}

export interface Neighborhood {
  id: string;
  municipalityId: string;
  zoneId: string;
  name: string;
  // Indicadores: ausentes (undefined) quando não há dado registrado — exibir "Sem dados".
  estimatedPopulation?: number;
  totalProperties?: number;
  totalSectors?: number;
  totalBlocks?: number;
  responsibleAgents?: string[];
  coveragePercentage?: number;
  fociCount?: number;
  pendingVisitsCount?: number;
  riskScore?: number; // 0 - 100
  riskLevel?: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';
  latitude?: number;
  longitude?: number;
}

export interface Sector {
  id: string;
  neighborhoodId: string;
  code: string;
  name: string;
  totalBlocks: number;
  totalProperties: number;
  coveragePercentage: number;
  supervisorId?: string;
}

export interface Block {
  id: string;
  sectorId: string;
  neighborhoodId: string;
  number: string;
  totalProperties: number;
  visitedProperties: number;
  fociCount: number;
  hasOutbreak: boolean;
}

export type PropertyType =
  | 'RESIDENCIA'
  | 'COMERCIO'
  | 'TERRENO_BALDIO'
  | 'IMOVEL_ABANDONADO'
  | 'ESCOLA'
  | 'UNIDADE_PUBLICA'
  | 'ESTABELECIMENTO_SAUDE'
  | 'BORRACHARIA'
  | 'OFICINA'
  | 'DEPOSITO'
  | 'INDUSTRIA'
  | 'OUTROS';

export type PropertyStatus =
  | 'NORMAL'
  | 'FOCO'
  | 'PENDENTE'
  | 'FECHADO'
  | 'RECUSA'
  | 'DESOCUPADO'
  | 'REINCIDENTE'
  | 'RISCO_CRITICO';

export interface Property {
  id: string;
  municipalityId: string;
  code: string; // Ex: IMV-00124
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  neighborhoodId: string;
  sector: string;
  block: string;
  latitude: number;
  longitude: number;
  zone: ZoneType;
  type: PropertyType;
  status: PropertyStatus;
  responsibleAgentId?: string;
  responsibleAgentName?: string;
  notes?: string;
  residentName?: string;
  residentPhone?: string;
  lastVisitDate?: string;
  lastVisitStatus?: string;
  totalVisitsCount: number;
  fociHistoryCount: number;
  isRecurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VisitSituation =
  | 'TRABALHADO' // Visitado e inspecionado
  | 'FECHADO'
  | 'RECUSA'
  | 'DESOCUPADO'
  | 'TERRENO'
  | 'ACESSO_IMPOSSIBILITADO'
  | 'IMOVEL_INEXISTENTE';

export type DepositCategory =
  | 'A1' // Armazenamento de água elevado (caixas d'água, reservatórios)
  | 'A2' // Armazenamento de água nível do solo (tonéis, tambores, cisternas, poços)
  | 'B'  // Pequenos depósitos móveis (vasos de plantas, pratos, garrafas, pingadeiras)
  | 'C'  // Depósitos fixos (calhas, ralos, piscinas não tratadas, lajes)
  | 'D1' // Pneus e materiais rodantes
  | 'D2' // Lixo, sucatas, entulhos, materiais recicláveis
  | 'E';  // Naturais (ocos de árvores, bromélias, bambus)

export interface DepositInspection {
  category: DepositCategory;
  name: string;
  quantity: number;
  hasWater: boolean;
  hasLarvae: boolean;
  isFoci: boolean;
  actionTaken: 'ELIMINADO' | 'VEDADO' | 'TRATADO' | 'ORIENTADO' | 'RETORNO_AGENDADO' | 'ENCAMINHADO';
  larvicideUsed?: string;
  larvicideQuantityGrams?: number;
}

export interface Visit {
  id: string;
  municipalityId: string;
  cycleId: string;
  propertyId: string;
  propertyCode: string;
  propertyAddress: string;
  propertyType: PropertyType;
  neighborhood: string;
  agentId: string;
  agentName: string;
  date: string;
  time: string;
  situation: VisitSituation;
  latitude?: number;
  longitude?: number;
  inspections: DepositInspection[];
  totalDepositsInspected: number;
  fociFound: boolean;
  fociEliminated: boolean;
  conduct: string;
  pendingReason?: string;
  nextScheduledVisit?: string;
  photoUrl?: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'ERROR';
  createdAt: string;
}

export interface FieldCycle {
  id: string;
  municipalityId: string;
  name: string; // Ex: 1º Ciclo 2026 (LIRAa / LIA)
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  // Progresso do ciclo: ausente quando não calculado a partir das visitas reais.
  goalPercentage?: number;
  currentCoveragePercentage?: number;
  totalTargetProperties?: number;
  visitedProperties?: number;
  fociCount?: number;
  closedCount?: number;
  refusalCount?: number;
  status: 'PLANEJADO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
}

export interface Ovitrap {
  id: string;
  code: string; // Ex: OVI-042
  qrCode: string;
  municipalityId: string;
  neighborhood: string;
  sector: string;
  address: string;
  latitude: number;
  longitude: number;
  installationDate: string;
  responsibleAgentId: string;
  responsibleAgentName: string;
  status: 'ATIVA' | 'COLETA_PENDENTE' | 'ANALISE' | 'DESATIVADA';
  lastCollectionDate?: string;
  lastEggCount?: number;
  isPositive?: boolean;
  consecutiveGrowth: boolean;
  growthAlert: boolean;
  history: {
    date: string;
    eggCount: number;
    isPositive: boolean;
    observations?: string;
    collectedBy: string;
  }[];
}

export type StrategicPointType =
  | 'BORRACHARIA'
  | 'FERRO_VELHO'
  | 'CEMITERIO'
  | 'RECICLADORA'
  | 'DEPOSITO_SUCATA'
  | 'PATIO_VEICULOS'
  | 'OFICINA_MECANICA'
  | 'OUTROS';

export interface StrategicPoint {
  id: string;
  municipalityId: string;
  name: string;
  type: StrategicPointType;
  contactName: string;
  contactPhone: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  inspectionFrequencyDays: number; // Ex: 15 dias padrão Ministério da Saúde
  responsibleAgentId: string;
  responsibleAgentName: string;
  riskLevel: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  lastInspectionDate?: string;
  nextInspectionDate: string;
  isInspectionOverdue: boolean;
  totalInspections: number;
  fociHistoryCount: number;
}

export interface SpecialProperty {
  id: string;
  municipalityId: string;
  name: string;
  type: 'ESCOLA' | 'HOSPITAL_UBS' | 'TERMINAL_RODOVIARIO' | 'ESTACAO_TREM' | 'ORGAO_PUBLICO';
  address: string;
  neighborhood: string;
  responsiblePerson: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  lastInspectionDate?: string;
  fociCount: number;
}

export interface EpidemiologicalEvent {
  id: string;
  municipalityId: string;
  disease: 'DENGUE' | 'CHIKUNGUNYA' | 'ZIKA' | 'LEISHMANIOSE' | 'FEBRE_AMARELA';
  notificationDate: string;
  neighborhood: string;
  sector: string;
  latitude: number;
  longitude: number;
  priority: 'ALTA' | 'URGENTE' | 'CRITICA';
  status: 'NOTIFICADO' | 'BLOQUEIO_PLANEJADO' | 'BLOQUEIO_EM_EXECUCAO' | 'CONCLUIDO';
  associatedBlockId?: string;
}

export interface EpidemiologicalBlock {
  id: string;
  code: string; // Ex: BLQ-2026-004
  municipalityId: string;
  eventId?: string;
  disease: string;
  targetNeighborhood: string;
  targetSector: string;
  radiusMeters: number; // 150m - 300m
  scheduledDate: string;
  assignedTeamId: string;
  assignedTeamName: string;
  priority: 'ALTA' | 'URGENTE';
  status: 'PLANEJADO' | 'EM_ANDAMENTO' | 'FINALIZADO';
  propertiesForecast: number;
  propertiesVisited: number;
  propertiesClosed: number;
  propertiesPending: number;
  fociFound: number;
  coveragePercentage: number;
}

export interface CitizenComplaint {
  id: string;
  protocol: string; // Ex: END-2026-000235
  municipalityId: string;
  type: 'AGUA_PARADA' | 'TERRENO_BALDIO' | 'PISCINA_ABANDONADA' | 'PNEUS' | 'LIXO_SUCATA' | 'IMOVEL_ABANDONADO' | 'POSSIVEL_FOCO';
  description: string;
  address: string;
  neighborhood: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  citizenName?: string;
  citizenPhone?: string;
  priority?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  status: 'RECEBIDA' | 'TRIAGEM' | 'ATRIBUIDA' | 'VISTORIA_REALIZADA' | 'RESOLVIDA';
  assignedAgentId?: string;
  assignedAgentName?: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  resolutionFociFound?: boolean;
}

export interface Team {
  id: string;
  name: string; // Ex: Equipe Norte 01
  municipalityId: string;
  supervisorId: string;
  supervisorName: string;
  assignedZone: ZoneType;
  assignedNeighborhoods: string[];
  membersCount: number;
  status: 'EM_CAMPO' | 'BASE' | 'DESLOCAMENTO' | 'FOLGA';
}

export interface SupplyItem {
  id: string;
  municipalityId: string;
  name: string; // Ex: Pyriproxyfen 0.5% Granulado, BTI Líquido
  category: 'LARVICIDA' | 'INSETICIDA_ADULTICIDA' | 'EPI' | 'UNIFORME' | 'MATERIAL_OVITRAMPA';
  unit: 'KG' | 'LITROS' | 'UNIDADE' | 'FRASCO' | 'PACOTE';
  currentStock: number;
  minimumStock: number;
  isLowStock: boolean;
  batches: {
    batchNumber: string;
    expirationDate: string;
    quantity: number;
    supplier: string;
    isNearExpiration: boolean;
  }[];
}

export interface Equipment {
  id: string;
  municipalityId: string;
  patrimonyNumber: string; // Ex: PAT-00982
  name: string; // Ex: Termonebulizador UBV Costal Guarany, Tablet Samsung Tab A9
  type: 'BOMBA_COSTAL' | 'TERMONEBULIZADOR' | 'TABLET' | 'GPS_PORTATIL' | 'VEICULO' | 'OUTROS';
  serialNumber: string;
  status: 'DISPONIVEL' | 'EM_USO' | 'MANUTENCAO' | 'INOPERANTE';
  assignedToUser?: string;
  lastMaintenanceDate: string;
  nextPreventiveMaintenanceDate: string;
  isMaintenanceOverdue: boolean;
}

export interface PlanningTask {
  id: string;
  municipalityId: string;
  date: string;
  type: 'VISITA_DE_ROTINA' | 'RETORNO_PENDENCIA' | 'BLOQUEIO_QUIMICO' | 'PONTO_ESTRATEGICO' | 'IMOVEL_ESPECIAL' | 'DENUNCIA' | 'OVITRAMPA' | 'MUTIRAO' | 'ACAO_EDUCATIVA';
  priority: 'NORMAL' | 'ATENCAO' | 'ALTA' | 'URGENTE';
  neighborhood: string;
  sector: string;
  block?: string;
  propertyCode?: string;
  assignedAgentId: string;
  assignedAgentName: string;
  supervisorId: string;
  supervisorName: string;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  notes?: string;
}

export interface RouteStop {
  id: string;
  sequence: number;
  propertyId: string;
  propertyCode: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  priorityOrder: number;
  reason: 'BLOQUEIO' | 'RISCO_CRITICO' | 'FOCO_RECENTE' | 'REINCIDENTE' | 'DENUNCIA' | 'RETORNO' | 'VISITA_NORMAL';
  status: 'PENDENTE' | 'VISITADO' | 'FECHADO';
}

export interface Alert {
  id: string;
  municipalityId: string;
  category: 'EPIDEMIOLOGICO' | 'ENTOMOLOGICO' | 'OPERACIONAL' | 'ADMINISTRATIVO';
  level: 'INFORMATIVO' | 'ATENCAO' | 'IMPORTANTE' | 'CRITICO';
  title: string;
  description: string;
  neighborhood?: string;
  sector?: string;
  assignedTo?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolutionAction?: string;
  createdAt: string;
}

export interface IntersectoralReferral {
  id: string;
  protocol: string;
  municipalityId: string;
  targetSector: 'VIGILANCIA_SANITARIA' | 'VIGILANCIA_EPIDEMIOLOGICA' | 'ATENCAO_PRIMARIA' | 'LIMPEZA_URBANA' | 'MEIO_AMBIENTE' | 'OBRAS_PUBLICAS' | 'ADMINISTRACAO';
  propertyAddress: string;
  neighborhood: string;
  latitude?: number;
  longitude?: number;
  description: string;
  issuedByAgentName: string;
  status: 'ENVIADO' | 'RECEBIDO' | 'EM_ANDAMENTO' | 'RESOLVIDO';
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface AuditLog {
  id: string;
  municipalityId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  operation: 'LOGIN' | 'LOGOUT' | 'CADASTRO' | 'EDICAO' | 'EXCLUSAO' | 'APROVACAO' | 'EXPORTACAO' | 'SINCRONIZACAO_OFFLINE';
  timestamp: string;
  ipAddress: string;
  device: string;
  module: string;
  recordIdentifier: string;
  previousValue?: string;
  newValue?: string;
}

export interface OperationalLoadAgent {
  agentId: string;
  agentName: string;
  teamName: string;
  totalVisits: number;
  coveragePercentage: number;
  pendingReturns: number;
  fociFound: number;
  blocksAssigned: number;
  complaintsAssigned: number;
  strategicPointsAssigned: number;
  ruralArea: boolean;
  operationalLoadIndex: number; // 0 - 100
  loadCategory: 'EQUILIBRADA' | 'MODERADA' | 'SOBRECARREGADA';
}
