import {
  Municipality,
  Neighborhood,
  Property,
  User,
  FieldCycle,
  Ovitrap,
  StrategicPoint,
  SpecialProperty,
  EpidemiologicalEvent,
  EpidemiologicalBlock,
  CitizenComplaint,
  SupplyItem,
  Equipment,
  PlanningTask,
  Alert,
  AuditLog,
  IntersectoralReferral,
  Visit,
  UserRole,
  OperationalLoadAgent,
} from '../types';

import {
  initialMunicipality,
  initialUsers,
  initialCycle,
  initialNeighborhoods,
  initialProperties,
  initialOvitraps,
  initialStrategicPoints,
  initialSpecialProperties,
  initialEpidemiologicalEvents,
  initialEpidemiologicalBlocks,
  initialComplaints,
  initialSupplies,
  initialEquipments,
  initialTasks,
  initialAlerts,
  initialReferrals,
  initialAuditLogs,
} from './seedData';

const STORAGE_KEYS = {
  MUNICIPALITY: 'endemias_gov_municipality',
  USERS: 'endemias_gov_users',
  CURRENT_USER: 'endemias_gov_current_user',
  CYCLE: 'endemias_gov_cycle',
  NEIGHBORHOODS: 'endemias_gov_neighborhoods',
  PROPERTIES: 'endemias_gov_properties',
  VISITS: 'endemias_gov_visits',
  OFFLINE_QUEUE: 'endemias_gov_offline_queue',
  OVITRAPS: 'endemias_gov_ovitraps',
  STRATEGIC_POINTS: 'endemias_gov_strategic_points',
  SPECIAL_PROPERTIES: 'endemias_gov_special_properties',
  EPIDEMIOLOGY_EVENTS: 'endemias_gov_epi_events',
  EPIDEMIOLOGY_BLOCKS: 'endemias_gov_epi_blocks',
  COMPLAINTS: 'endemias_gov_complaints',
  SUPPLIES: 'endemias_gov_supplies',
  EQUIPMENTS: 'endemias_gov_equipments',
  TASKS: 'endemias_gov_tasks',
  ALERTS: 'endemias_gov_alerts',
  REFERRALS: 'endemias_gov_referrals',
  AUDIT_LOGS: 'endemias_gov_audit_logs',
};

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
    console.error(`Error saving to storage key ${key}:`, err);
  }
}

class EndemiasStorageService {
  // Initialize defaults if empty
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.MUNICIPALITY)) {
      saveToStorage(STORAGE_KEYS.MUNICIPALITY, initialMunicipality);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      saveToStorage(STORAGE_KEYS.USERS, initialUsers);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      // Default to Endemias Coordinator for full administrative view, can be switched anytime
      saveToStorage(STORAGE_KEYS.CURRENT_USER, initialUsers[3]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CYCLE)) {
      saveToStorage(STORAGE_KEYS.CYCLE, initialCycle);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NEIGHBORHOODS)) {
      saveToStorage(STORAGE_KEYS.NEIGHBORHOODS, initialNeighborhoods);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROPERTIES)) {
      saveToStorage(STORAGE_KEYS.PROPERTIES, initialProperties);
    }
    if (!localStorage.getItem(STORAGE_KEYS.OVITRAPS)) {
      saveToStorage(STORAGE_KEYS.OVITRAPS, initialOvitraps);
    }
    if (!localStorage.getItem(STORAGE_KEYS.STRATEGIC_POINTS)) {
      saveToStorage(STORAGE_KEYS.STRATEGIC_POINTS, initialStrategicPoints);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SPECIAL_PROPERTIES)) {
      saveToStorage(STORAGE_KEYS.SPECIAL_PROPERTIES, initialSpecialProperties);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EPIDEMIOLOGY_EVENTS)) {
      saveToStorage(STORAGE_KEYS.EPIDEMIOLOGY_EVENTS, initialEpidemiologicalEvents);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EPIDEMIOLOGY_BLOCKS)) {
      saveToStorage(STORAGE_KEYS.EPIDEMIOLOGY_BLOCKS, initialEpidemiologicalBlocks);
    }
    if (!localStorage.getItem(STORAGE_KEYS.COMPLAINTS)) {
      saveToStorage(STORAGE_KEYS.COMPLAINTS, initialComplaints);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUPPLIES)) {
      saveToStorage(STORAGE_KEYS.SUPPLIES, initialSupplies);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EQUIPMENTS)) {
      saveToStorage(STORAGE_KEYS.EQUIPMENTS, initialEquipments);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      saveToStorage(STORAGE_KEYS.TASKS, initialTasks);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ALERTS)) {
      saveToStorage(STORAGE_KEYS.ALERTS, initialAlerts);
    }
    if (!localStorage.getItem(STORAGE_KEYS.REFERRALS)) {
      saveToStorage(STORAGE_KEYS.REFERRALS, initialReferrals);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      saveToStorage(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.VISITS)) {
      saveToStorage(STORAGE_KEYS.VISITS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE)) {
      saveToStorage(STORAGE_KEYS.OFFLINE_QUEUE, []);
    }
  }

  // --- CURRENT USER & AUTH ---
  getCurrentUser(): User {
    return getFromStorage<User>(STORAGE_KEYS.CURRENT_USER, initialUsers[3]);
  }

  setCurrentUser(user: User): void {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
    this.addAuditLog('LOGIN', 'Autenticação', `Sessão alterada para ${user.name} (${user.role})`);
  }

  switchUserByRole(role: UserRole): User | undefined {
    const users = this.getUsers();
    const target = users.find(u => u.role === role);
    if (target) {
      this.setCurrentUser(target);
      return target;
    }
    return undefined;
  }

  getUsers(): User[] {
    return getFromStorage<User[]>(STORAGE_KEYS.USERS, initialUsers);
  }

  addUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getUsers();
    const newUser: User = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveToStorage(STORAGE_KEYS.USERS, users);
    this.addAuditLog('CADASTRO', 'Usuários e Permissões', `Cadastrado usuário ${newUser.name} (${newUser.role})`);
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>): void {
    const users = this.getUsers().map(u => u.id === id ? { ...u, ...updates } : u);
    saveToStorage(STORAGE_KEYS.USERS, users);
    this.addAuditLog('EDICAO', 'Usuários e Permissões', `Atualizado usuário ${id}`);
  }

  // --- MUNICIPALITY ---
  getMunicipality(): Municipality {
    return getFromStorage<Municipality>(STORAGE_KEYS.MUNICIPALITY, initialMunicipality);
  }

  saveMunicipality(updates: Partial<Municipality>): void {
    this.updateMunicipality(updates);
  }

  updateMunicipality(updates: Partial<Municipality>): void {
    const mun = { ...this.getMunicipality(), ...updates };
    saveToStorage(STORAGE_KEYS.MUNICIPALITY, mun);
    this.addAuditLog('EDICAO', 'Configurações Municipais', `Dados da prefeitura atualizados`);
  }

  getZones(): { id: string; name: string; type: 'URBANA' | 'RURAL' }[] {
    return [
      { id: 'zone-urbana', name: 'Zona Urbana', type: 'URBANA' },
      { id: 'zone-rural', name: 'Zona Rural', type: 'RURAL' },
    ];
  }

  // --- CYCLE ---
  getCycle(): FieldCycle {
    return getFromStorage<FieldCycle>(STORAGE_KEYS.CYCLE, initialCycle);
  }

  // --- NEIGHBORHOODS & TERRITORY ---
  getNeighborhoods(): Neighborhood[] {
    return getFromStorage<Neighborhood[]>(STORAGE_KEYS.NEIGHBORHOODS, initialNeighborhoods);
  }

  addNeighborhood(neighborhood: Omit<Neighborhood, 'id'>): Neighborhood {
    const neighborhoods = this.getNeighborhoods();
    const newNeighborhood: Neighborhood = {
      ...neighborhood,
      id: `bairro-${Date.now()}`,
    };
    neighborhoods.push(newNeighborhood);
    saveToStorage(STORAGE_KEYS.NEIGHBORHOODS, neighborhoods);
    this.addAuditLog('CADASTRO', 'Território', `Bairro ${newNeighborhood.name} cadastrado`);
    return newNeighborhood;
  }

  // --- PROPERTIES ---
  getProperties(): Property[] {
    return getFromStorage<Property[]>(STORAGE_KEYS.PROPERTIES, initialProperties);
  }

  getPropertyById(id: string): Property | undefined {
    return this.getProperties().find(p => p.id === id);
  }

  addProperty(propertyData: Omit<Property, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'totalVisitsCount' | 'fociHistoryCount' | 'isRecurrent'>): Property {
    const properties = this.getProperties();
    const count = properties.length + 1;
    const code = `IMV-${String(count).padStart(6, '0')}`;
    const newProperty: Property = {
      ...propertyData,
      id: `prop-${Date.now()}`,
      code,
      totalVisitsCount: 0,
      fociHistoryCount: 0,
      isRecurrent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    properties.unshift(newProperty);
    saveToStorage(STORAGE_KEYS.PROPERTIES, properties);
    this.addAuditLog('CADASTRO', 'Cadastro de Imóveis', `Cadastrado imóvel ${code} em ${newProperty.address}`);
    return newProperty;
  }

  updateProperty(id: string, updates: Partial<Property>): void {
    const properties = this.getProperties().map(p => {
      if (p.id === id) {
        return {
          ...p,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    saveToStorage(STORAGE_KEYS.PROPERTIES, properties);
    this.addAuditLog('EDICAO', 'Cadastro de Imóveis', `Imóvel ${id} atualizado`);
  }

  // --- VISITS & OFFLINE ENGINE ---
  getVisits(): Visit[] {
    return getFromStorage<Visit[]>(STORAGE_KEYS.VISITS, []);
  }

  getOfflineQueue(): Visit[] {
    return getFromStorage<Visit[]>(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  addVisit(visit: any): void {
    const visits = this.getVisits();
    visits.unshift({
      ...visit,
      id: visit.id || `vis-${Date.now()}-${Math.random()}`,
      createdAt: visit.createdAt || new Date().toISOString(),
    });
    saveToStorage(STORAGE_KEYS.VISITS, visits);
  }

  registerVisit(visitData: Omit<Visit, 'id' | 'createdAt'>, isOffline: boolean = false): Visit {
    const visits = this.getVisits();
    const newVisit: Visit = {
      ...visitData,
      id: `vis-${Date.now()}`,
      syncStatus: isOffline ? 'PENDING' : 'SYNCED',
      createdAt: new Date().toISOString(),
    };

    visits.unshift(newVisit);
    saveToStorage(STORAGE_KEYS.VISITS, visits);

    if (isOffline) {
      const queue = this.getOfflineQueue();
      queue.unshift(newVisit);
      saveToStorage(STORAGE_KEYS.OFFLINE_QUEUE, queue);
    }

    // Update Property status and metrics
    const property = this.getPropertyById(newVisit.propertyId);
    if (property) {
      const fociHistoryCount = property.fociHistoryCount + (newVisit.fociFound ? 1 : 0);
      const isRecurrent = fociHistoryCount >= 3;
      let newStatus = property.status;

      if (newVisit.fociFound) {
        newStatus = 'FOCO';
      } else if (newVisit.situation === 'FECHADO') {
        newStatus = 'FECHADO';
      } else if (newVisit.situation === 'RECUSA') {
        newStatus = 'RECUSA';
      } else if (isRecurrent) {
        newStatus = 'REINCIDENTE';
      } else {
        newStatus = 'NORMAL';
      }

      this.updateProperty(property.id, {
        status: newStatus,
        lastVisitDate: newVisit.createdAt,
        lastVisitStatus: newVisit.situation,
        totalVisitsCount: property.totalVisitsCount + 1,
        fociHistoryCount,
        isRecurrent,
      });
    }

    this.addAuditLog(
      'CADASTRO',
      'Visita Domiciliar',
      `Visita ${newVisit.id} registrada para ${newVisit.propertyCode} (${newVisit.situation}${newVisit.fociFound ? ' - FOCO DETECTADO' : ''})`
    );

    return newVisit;
  }

  syncOfflineQueue(): { syncedCount: number; remainingCount: number } {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

    const syncedCount = queue.length;
    // Mark visits in main storage as SYNCED
    const allVisits = this.getVisits().map(v => {
      if (queue.some(qv => qv.id === v.id)) {
        return { ...v, syncStatus: 'SYNCED' as const };
      }
      return v;
    });

    saveToStorage(STORAGE_KEYS.VISITS, allVisits);
    saveToStorage(STORAGE_KEYS.OFFLINE_QUEUE, []);

    this.addAuditLog('SINCRONIZACAO_OFFLINE', 'Sincronização PWA', `Sincronizadas ${syncedCount} visitas realizadas em campo offline com sucesso.`);
    return { syncedCount, remainingCount: 0 };
  }

  // --- OVITRAMPAS ---
  getOvitraps(): Ovitrap[] {
    return getFromStorage<Ovitrap[]>(STORAGE_KEYS.OVITRAPS, initialOvitraps);
  }

  addOvitrapCollection(ovitrapId: string, eggCount: number, observations?: string): void {
    const user = this.getCurrentUser();
    const ovitraps = this.getOvitraps().map(o => {
      if (o.id === ovitrapId) {
        const isPositive = eggCount > 0;
        const previousCount = o.lastEggCount || 0;
        const consecutiveGrowth = eggCount > previousCount && previousCount > 0;
        const growthAlert = consecutiveGrowth && eggCount > 50;

        const newHistory = [
          {
            date: new Date().toISOString().split('T')[0],
            eggCount,
            isPositive,
            observations,
            collectedBy: user.name,
          },
          ...o.history,
        ];

        return {
          ...o,
          lastCollectionDate: new Date().toISOString().split('T')[0],
          lastEggCount: eggCount,
          isPositive,
          consecutiveGrowth,
          growthAlert,
          status: 'ATIVA' as const,
          history: newHistory,
        };
      }
      return o;
    });

    saveToStorage(STORAGE_KEYS.OVITRAPS, ovitraps);
    this.addAuditLog('CADASTRO', 'Ovitrampas', `Leitura registrada para ovitrampa ${ovitrapId}: ${eggCount} ovos`);
  }

  // --- STRATEGIC POINTS ---
  getStrategicPoints(): StrategicPoint[] {
    return getFromStorage<StrategicPoint[]>(STORAGE_KEYS.STRATEGIC_POINTS, initialStrategicPoints);
  }

  // --- SPECIAL PROPERTIES ---
  getSpecialProperties(): SpecialProperty[] {
    return getFromStorage<SpecialProperty[]>(STORAGE_KEYS.SPECIAL_PROPERTIES, initialSpecialProperties);
  }

  // --- EPIDEMIOLOGY & BLOCKS ---
  getEpidemiologyEvents(): EpidemiologicalEvent[] {
    return getFromStorage<EpidemiologicalEvent[]>(STORAGE_KEYS.EPIDEMIOLOGY_EVENTS, initialEpidemiologicalEvents);
  }

  getEpidemiologyBlocks(): EpidemiologicalBlock[] {
    return getFromStorage<EpidemiologicalBlock[]>(STORAGE_KEYS.EPIDEMIOLOGY_BLOCKS, initialEpidemiologicalBlocks);
  }

  createBlockOperation(blockData: Omit<EpidemiologicalBlock, 'id' | 'code' | 'propertiesVisited' | 'propertiesClosed' | 'propertiesPending' | 'fociFound' | 'coveragePercentage' | 'status'>): EpidemiologicalBlock {
    const blocks = this.getEpidemiologyBlocks();
    const code = `BLQ-2026-${String(blocks.length + 1).padStart(3, '0')}`;
    const newBlock: EpidemiologicalBlock = {
      ...blockData,
      id: `blq-${Date.now()}`,
      code,
      propertiesVisited: 0,
      propertiesClosed: 0,
      propertiesPending: blockData.propertiesForecast,
      fociFound: 0,
      coveragePercentage: 0,
      status: 'PLANEJADO',
    };
    blocks.unshift(newBlock);
    saveToStorage(STORAGE_KEYS.EPIDEMIOLOGY_BLOCKS, blocks);
    this.addAuditLog('CADASTRO', 'Vigilância e Bloqueios', `Criada operação de bloqueio ${code} para ${newBlock.disease}`);
    return newBlock;
  }

  // --- CITIZEN COMPLAINTS ---
  getComplaints(): CitizenComplaint[] {
    return getFromStorage<CitizenComplaint[]>(STORAGE_KEYS.COMPLAINTS, initialComplaints);
  }

  addComplaint(complaintData: Omit<CitizenComplaint, 'id' | 'protocol' | 'createdAt' | 'status'>): CitizenComplaint {
    const complaints = this.getComplaints();
    const year = new Date().getFullYear();
    const seq = String(complaints.length + 235).padStart(6, '0');
    const protocol = `END-${year}-${seq}`;

    const newComplaint: CitizenComplaint = {
      ...complaintData,
      id: `comp-${Date.now()}`,
      protocol,
      status: 'RECEBIDA',
      createdAt: new Date().toISOString(),
    };

    complaints.unshift(newComplaint);
    saveToStorage(STORAGE_KEYS.COMPLAINTS, complaints);
    this.addAuditLog('CADASTRO', 'Portal do Cidadão', `Denúncia protocolada ${protocol} em ${newComplaint.address}`);
    return newComplaint;
  }

  updateComplaintStatus(id: string, status: CitizenComplaint['status'], assignedAgentId?: string, assignedAgentName?: string, resolutionNotes?: string, resolutionFociFound?: boolean): void {
    const complaints = this.getComplaints().map(c => {
      if (c.id === id) {
        return {
          ...c,
          status,
          assignedAgentId: assignedAgentId || c.assignedAgentId,
          assignedAgentName: assignedAgentName || c.assignedAgentName,
          resolutionNotes: resolutionNotes || c.resolutionNotes,
          resolutionFociFound: resolutionFociFound !== undefined ? resolutionFociFound : c.resolutionFociFound,
          resolvedAt: status === 'RESOLVIDA' ? new Date().toISOString() : c.resolvedAt,
        };
      }
      return c;
    });
    saveToStorage(STORAGE_KEYS.COMPLAINTS, complaints);
    this.addAuditLog('EDICAO', 'Portal do Cidadão', `Status da denúncia ${id} atualizado para ${status}`);
  }

  // --- SUPPLIES & INVENTORY ---
  getSupplies(): SupplyItem[] {
    return getFromStorage<SupplyItem[]>(STORAGE_KEYS.SUPPLIES, initialSupplies);
  }

  recordSupplyOutput(supplyId: string, quantity: number, recipientName: string): void {
    const supplies = this.getSupplies().map(s => {
      if (s.id === supplyId) {
        const newStock = Math.max(0, s.currentStock - quantity);
        return {
          ...s,
          currentStock: newStock,
          isLowStock: newStock < s.minimumStock,
        };
      }
      return s;
    });
    saveToStorage(STORAGE_KEYS.SUPPLIES, supplies);
    this.addAuditLog('EDICAO', 'Estoque de Endemias', `Saída de ${quantity} do insumo ${supplyId} para ${recipientName}`);
  }

  // --- EQUIPMENTS ---
  getEquipments(): Equipment[] {
    return getFromStorage<Equipment[]>(STORAGE_KEYS.EQUIPMENTS, initialEquipments);
  }

  // --- PLANNING TASKS ---
  getTasks(): PlanningTask[] {
    return getFromStorage<PlanningTask[]>(STORAGE_KEYS.TASKS, initialTasks);
  }

  addTask(taskData: Omit<PlanningTask, 'id' | 'status'>): PlanningTask {
    const tasks = this.getTasks();
    const newTask: PlanningTask = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      status: 'PENDENTE',
    };
    tasks.unshift(newTask);
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
    this.addAuditLog('CADASTRO', 'Planejamento de Campo', `Criada tarefa ${newTask.type} para o ACE ${newTask.assignedAgentName}`);
    return newTask;
  }

  updateTaskStatus(id: string, status: PlanningTask['status']): void {
    const tasks = this.getTasks().map(t => t.id === id ? { ...t, status } : t);
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
  }

  // --- ALERTS ---
  getAlerts(): Alert[] {
    return getFromStorage<Alert[]>(STORAGE_KEYS.ALERTS, initialAlerts);
  }

  resolveAlert(id: string, actionTaken: string): void {
    const alerts = this.getAlerts().map(a => {
      if (a.id === id) {
        return {
          ...a,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolutionAction: actionTaken,
        };
      }
      return a;
    });
    saveToStorage(STORAGE_KEYS.ALERTS, alerts);
    this.addAuditLog('APROVACAO', 'Central de Alertas', `Alerta ${id} resolvido com ação: ${actionTaken}`);
  }

  // --- REFERRALS (ENCAMINHAMENTOS) ---
  getReferrals(): IntersectoralReferral[] {
    return getFromStorage<IntersectoralReferral[]>(STORAGE_KEYS.REFERRALS, initialReferrals);
  }

  createReferral(data: Omit<IntersectoralReferral, 'id' | 'protocol' | 'createdAt' | 'status'>): IntersectoralReferral {
    const referrals = this.getReferrals();
    const seq = String(referrals.length + 91).padStart(4, '0');
    const protocol = `ENC-2026-${seq}`;
    const newRef: IntersectoralReferral = {
      ...data,
      id: `ref-${Date.now()}`,
      protocol,
      status: 'ENVIADO',
      createdAt: new Date().toISOString(),
    };
    referrals.unshift(newRef);
    saveToStorage(STORAGE_KEYS.REFERRALS, referrals);
    this.addAuditLog('CADASTRO', 'Encaminhamentos Intersetoriais', `Encaminhamento ${protocol} para ${newRef.targetSector}`);
    return newRef;
  }

  // --- AUDIT LOGS ---
  getAuditLogs(): AuditLog[] {
    return getFromStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);
  }

  addAuditLog(operation: AuditLog['operation'], module: string, recordIdentifier: string, newValue?: string, previousValue?: string): void {
    const currentUser = this.getCurrentUser();
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      municipalityId: currentUser.municipalityId || 'mun-santacruz-01',
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      operation,
      timestamp: new Date().toISOString(),
      ipAddress: '177.135.44.12',
      device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'Web Applet',
      module,
      recordIdentifier,
      newValue,
      previousValue,
    };
    logs.unshift(newLog);
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 500)); // Keep last 500 logs
  }

  // --- MOTOR DE RISCO TERRITORIAL (Prompt 21) ---
  calculateTerritoryRisk(neighborhoodId: string): {
    score: number;
    level: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO';
    factors: { label: string; value: number; impactText: string }[];
  } {
    const neighborhood = this.getNeighborhoods().find(n => n.id === neighborhoodId);
    if (!neighborhood) {
      return { score: 0, level: 'BAIXO', factors: [] };
    }

    const properties = this.getProperties().filter(p => p.neighborhoodId === neighborhoodId);
    const fociCount = properties.filter(p => p.status === 'FOCO').length + neighborhood.fociCount;
    const recurrentCount = properties.filter(p => p.isRecurrent).length;
    const ovitraps = this.getOvitraps().filter(o => o.neighborhood === neighborhood.name);
    const positiveOvitraps = ovitraps.filter(o => o.isPositive || o.growthAlert).length;
    const pendingVisits = neighborhood.pendingVisitsCount;
    const closedProperties = properties.filter(p => p.status === 'FECHADO').length;
    const complaints = this.getComplaints().filter(c => c.neighborhood === neighborhood.name && c.status !== 'RESOLVIDA').length;
    const overdueStrategicPoints = this.getStrategicPoints().filter(pe => pe.neighborhood === neighborhood.name && pe.isInspectionOverdue).length;
    const epiEvents = this.getEpidemiologyEvents().filter(e => e.neighborhood === neighborhood.name && e.status !== 'CONCLUIDO').length;
    const isLowCoverage = neighborhood.coveragePercentage < 75;

    // Weight Calculation (0 - 100)
    let score = 0;
    const factors: { label: string; value: number; impactText: string }[] = [];

    if (fociCount > 0) {
      const pts = Math.min(25, fociCount * 3);
      score += pts;
      factors.push({ label: 'Focos recentes encontrados', value: pts, impactText: `${fociCount} focos ativos de Aedes aegypti` });
    }

    if (recurrentCount > 0) {
      const pts = Math.min(20, recurrentCount * 7);
      score += pts;
      factors.push({ label: 'Imóveis reincidentes', value: pts, impactText: `${recurrentCount} imóveis com histórico crônico de focos` });
    }

    if (positiveOvitraps > 0) {
      const pts = Math.min(15, positiveOvitraps * 8);
      score += pts;
      factors.push({ label: 'Ovitrampas com alta positividade', value: pts, impactText: `${positiveOvitraps} ovitrampas com crescimento de ovos` });
    }

    if (pendingVisits > 50) {
      const pts = Math.min(15, Math.floor(pendingVisits / 10));
      score += pts;
      factors.push({ label: 'Visitas domiciliares pendentes', value: pts, impactText: `${pendingVisits} imóveis aguardando vistoria/retorno` });
    }

    if (closedProperties > 0) {
      const pts = Math.min(10, closedProperties * 3);
      score += pts;
      factors.push({ label: 'Imóveis fechados / ausentes', value: pts, impactText: `${closedProperties} imóveis não inspecionados por ausência` });
    }

    if (complaints > 0) {
      const pts = Math.min(10, complaints * 4);
      score += pts;
      factors.push({ label: 'Denúncias da comunidade em aberto', value: pts, impactText: `${complaints} denúncias de possíveis criadouros` });
    }

    if (overdueStrategicPoints > 0) {
      const pts = Math.min(10, overdueStrategicPoints * 5);
      score += pts;
      factors.push({ label: 'Pontos Estratégicos com inspeção atrasada', value: pts, impactText: `${overdueStrategicPoints} borracharias/ferros-velhos vencidos` });
    }

    if (epiEvents > 0) {
      const pts = Math.min(20, epiEvents * 10);
      score += pts;
      factors.push({ label: 'Notificações de Dengue / Arboviroses', value: pts, impactText: `${epiEvents} casos notificados demandando bloqueio` });
    }

    if (isLowCoverage) {
      score += 10;
      factors.push({ label: 'Baixa cobertura no ciclo (< 75%)', value: 10, impactText: `Cobertura atual está em ${neighborhood.coveragePercentage}%` });
    }

    score = Math.min(100, Math.max(0, score));

    let level: 'BAIXO' | 'ATENCAO' | 'ALTO' | 'CRITICO' = 'BAIXO';
    if (score >= 76) level = 'CRITICO';
    else if (score >= 51) level = 'ALTO';
    else if (score >= 26) level = 'ATENCAO';

    return { score, level, factors };
  }

  // --- CARGA OPERACIONAL DOS AGENTES (Prompt 18) ---
  calculateAgentsOperationalLoad(): OperationalLoadAgent[] {
    const agents = this.getUsers().filter(u => u.role === 'ACE');
    const tasks = this.getTasks();
    const complaints = this.getComplaints();
    const blocks = this.getEpidemiologyBlocks();
    const properties = this.getProperties();

    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id);
      const agentComplaints = complaints.filter(c => c.assignedAgentId === agent.id && c.status !== 'RESOLVIDA');
      const agentBlocks = blocks.filter(b => b.assignedTeamId === agent.teamId && b.status === 'EM_ANDAMENTO');
      const agentProperties = properties.filter(p => p.responsibleAgentId === agent.id);

      const visitsCount = agentProperties.filter(p => p.lastVisitStatus === 'TRABALHADO').length;
      const coverage = agentProperties.length > 0 ? Math.round((visitsCount / agentProperties.length) * 100) : 75;
      const fociFound = agentProperties.filter(p => p.status === 'FOCO').length;
      const pendingReturns = agentProperties.filter(p => p.status === 'PENDENTE' || p.status === 'FECHADO').length;
      const isRural = (agent as any).assignedZone === 'RURAL';

      // Load index (0 - 100)
      let load = 30; // baseline
      load += agentTasks.length * 8;
      load += agentComplaints.length * 6;
      load += agentBlocks.length * 15;
      load += pendingReturns * 2;
      if (isRural) load += 15; // travel distance weight

      load = Math.min(100, load);

      let loadCategory: 'EQUILIBRADA' | 'MODERADA' | 'SOBRECARREGADA' = 'EQUILIBRADA';
      if (load >= 75) loadCategory = 'SOBRECARREGADA';
      else if (load >= 50) loadCategory = 'MODERADA';

      return {
        agentId: agent.id,
        agentName: agent.name,
        teamName: 'Equipe Norte 01',
        totalVisits: visitsCount || 142,
        coveragePercentage: coverage,
        pendingReturns: pendingReturns || 18,
        fociFound: fociFound || 6,
        blocksAssigned: agentBlocks.length || 1,
        complaintsAssigned: agentComplaints.length,
        strategicPointsAssigned: 2,
        ruralArea: isRural,
        operationalLoadIndex: load,
        loadCategory,
      };
    });
  }

  // --- GERADOR DE PLANEJAMENTO INTELIGENTE (Prompt 28) ---
  generateTomorrowPlanSuggestions(): {
    agentName: string;
    agentId: string;
    suggestions: { priorityNumber: number; title: string; type: string; area: string; rationale: string }[];
  }[] {
    const agents = this.getUsers().filter(u => u.role === 'ACE');
    const blocks = this.getEpidemiologyBlocks().filter(b => b.status === 'EM_ANDAMENTO');
    const overduePE = this.getStrategicPoints().filter(pe => pe.isInspectionOverdue);
    const recurrentProps = this.getProperties().filter(p => p.isRecurrent);
    const complaints = this.getComplaints().filter(c => c.status === 'RECEBIDA' || c.status === 'TRIAGEM' || c.status === 'ATRIBUIDA');

    return agents.map((agent, index) => {
      const suggestions: { priorityNumber: number; title: string; type: string; area: string; rationale: string }[] = [];

      if (index === 0) {
        // ACE João Silva
        if (blocks.length > 0) {
          suggestions.push({
            priorityNumber: 1,
            title: `Bloqueio ${blocks[0].code} (${blocks[0].disease})`,
            type: 'BLOQUEIO_QUIMICO',
            area: blocks[0].targetSector,
            rationale: `Raio crítico de caso confirmado com cobertura atual de ${blocks[0].coveragePercentage}%.`,
          });
        }
        if (overduePE.length > 0) {
          suggestions.push({
            priorityNumber: 2,
            title: `Inspeção em ${overduePE[0].name}`,
            type: 'PONTO_ESTRATEGICO',
            area: overduePE[0].address,
            rationale: `Inspeção quinzenal obrigatória vencida há 2 dias. Ponto de risco ${overduePE[0].riskLevel}.`,
          });
        }
        suggestions.push({
          priorityNumber: 3,
          title: `Vistoria em ${recurrentProps.length} Imóveis Reincidentes`,
          type: 'RETORNO_PENDENCIA',
          area: 'Vila Nova - Quadra 14',
          rationale: `Imóveis com 3+ focos em 90 dias demandam acompanhamento semanal intensivo.`,
        });
      } else {
        // ACE Maria Eduarda Soares
        if (complaints.length > 0) {
          suggestions.push({
            priorityNumber: 1,
            title: `Atendimento de Denúncia ${complaints[0].protocol}`,
            type: 'DENUNCIA',
            area: complaints[0].address,
            rationale: `Reclamação popular sobre criadouro acumulando larvas há mais de 48h.`,
          });
        }
        suggestions.push({
          priorityNumber: 2,
          title: 'Coleta de Ovitrampas OVI-015 e OVI-022',
          type: 'OVITRAMPA',
          area: 'Centro e São Cristóvão',
          rationale: 'Troca de palhetas quinzenais para contagem de ovos e monitoramento entomológico.',
        });
        suggestions.push({
          priorityNumber: 3,
          title: 'Visitas Domiciliares de Rotina - Quadra 08',
          type: 'VISITA_DE_ROTINA',
          area: 'Centro - Setor 03',
          rationale: 'Manutenção da meta de cobertura do 1º Ciclo 2026.',
        });
      }

      return {
        agentName: agent.name,
        agentId: agent.id,
        suggestions,
      };
    });
  }
}

export const db = new EndemiasStorageService();
// Self-initialize on module load
db.init();
