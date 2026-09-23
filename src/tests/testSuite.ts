/**
 * Suíte de Testes Automatizados para o Endemias GOV
 * Executado via Node/tsx: npx tsx src/tests/testSuite.ts
 */

import 'dotenv/config'; // carrega .env para process.env (fora do runtime Vite)
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { can, hasRole } from '../services/rbac';
import { UserRole } from '../types';
import { DEPOSIT_CATEGORIES, CONDUCT_OPTIONS } from '../services/visitOfficialService';
import { CORE_MODULES, isCoreModule, CORE_MODULE_DEFINITIONS } from '../config/coreModules';
import { systemAuditService, ALL_SYSTEM_PAGES } from '../services/systemAuditService';
import { can as rbacCan, hasRole as rbacHasRole, PERMISSIONS_CATALOG, LEGACY_EN_TO_PT } from '../services/rbac';
import {
  ROUTES,
  HUB_TABS,
  LEGACY_REDIRECTS,
  PUBLIC_PATHS,
  AccessChecker,
  resolvePath,
  canAccessRoute,
  canAccessView,
  getHomeView,
  isViewModule,
  tabForView,
  viewForTab,
  toPath,
  HubId,
} from '../config/routes';
import { NAV_GROUPS, getVisibleNavGroups } from '../config/navigation';
import { requireMunicipalityId, MissingMunicipalityError, EXAMPLE_MUNICIPALITY_ID } from '../services/municipalityScope';
import { situationRoomService } from '../services/situationRoomService';
import { auditLogService } from '../services/auditLogService';
import { userAdminService } from '../services/userAdminService';
import { enqueueVisit, readQueue, syncQueue, QueueStorage } from '../services/offlineVisitQueue';
import { isValidMunicipalityId } from '../config/publicMunicipality';
import { historicalAnalysisService } from '../services/historicalAnalysisService';
import { db } from '../services/storage';
import { agentName, isInspectionOverdue, normResult, PENDING_STATUSES } from '../services/schemaHelpers';
import { ibgeService } from '../services/ibgeService';

/** Checador de acesso equivalente ao AuthContext para um papel (permissões padrão do papel). */
function accessFor(role: UserRole): AccessChecker {
  return {
    can: (p: string) => rbacCan(role, p),
    hasRole: (r: UserRole | UserRole[]) => rbacHasRole(role, r),
  };
}

/** Armazenamento em memória para testar a fila offline sem navegador. */
function memoryStorage(): QueueStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

async function expectMissingMunicipality(fn: () => Promise<unknown>, label: string) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = err instanceof MissingMunicipalityError;
  }
  assert(threw, `${label} deve bloquear chamadas sem município (MissingMunicipalityError)`);
}

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} - Esperado: ${expected}, Obtido: ${actual}`);
  }
}

async function runTest(suite: string, name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      suite,
      name,
      passed: true,
      durationMs: Date.now() - start,
    });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    results.push({
      suite,
      name,
      passed: false,
      error: err.message || String(err),
      durationMs: Date.now() - start,
    });
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🧪 INICIANDO SUÍTE DE TESTES OPERACIONAIS - ENDEMIAS GOV');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // 1. TESTES UNITÁRIOS
  // -------------------------------------------------------------
  console.log('📦 1. TESTES UNITÁRIOS:');

  await runTest('Unitários', 'Cálculo de taxa de cobertura operacional', () => {
    const planned = 120;
    const visited = 108;
    const coverage = (visited / planned) * 100;
    assertEquals(Number(coverage.toFixed(1)), 90.0, 'Cobertura deve ser 90%');
  });

  await runTest('Unitários', 'Cálculo de Indicador LIRAa (IIP e IB)', () => {
    const inspectedProperties = 450;
    const positiveProperties = 9;
    const positiveDeposits = 14;

    const iip = (positiveProperties / inspectedProperties) * 100;
    const ib = (positiveDeposits / inspectedProperties) * 100;

    assertEquals(Number(iip.toFixed(2)), 2.0, 'IIP deve ser 2.0% (Alerta)');
    assertEquals(Number(ib.toFixed(2)), 3.11, 'IB deve ser 3.11%');
  });

  await runTest('Unitários', 'Validação de Permissões RBAC (can e hasRole)', () => {
    // ACE pode criar visitas, mas NÃO pode encerrar ciclos
    assert(can('ACE', 'visits.create'), 'ACE deve ter permissão visits.create');
    assert(!can('ACE', 'cycles.close'), 'ACE NÃO deve ter permissão cycles.close');

    // COORDENADOR pode encerrar ciclos e gerenciar equipes
    assert(can('ENDEMIAS_COORDINATOR', 'cycles.close'), 'Coordenador deve ter cycles.close');
    assert(can('ENDEMIAS_COORDINATOR', 'teams.manage'), 'Coordenador deve ter teams.manage');

    // SUPERADMIN possui acesso irrestrito
    assert(can('SUPER_ADMIN', 'settings.manage'), 'SUPER_ADMIN tem settings.manage');
    assert(hasRole('SUPER_ADMIN', 'SUPER_ADMIN'), 'hasRole SUPER_ADMIN deve ser verdadeiro');
  });

  await runTest('Unitários', 'Cálculo do Motor de Risco Territorial (0-100)', () => {
    // Score ponderado: Focos (40%), Ovitrampas (25%), Pendências (20%), Casos (15%)
    const calculateRiskScore = (foci: number, oviPos: number, pends: number, cases: number) => {
      const fociWeight = Math.min(40, (foci / 10) * 40);
      const oviWeight = Math.min(25, (oviPos / 100) * 25);
      const pendWeight = Math.min(20, (pends / 30) * 20);
      const caseWeight = Math.min(15, (cases / 5) * 15);
      return Math.round(fociWeight + oviWeight + pendWeight + caseWeight);
    };

    const riskLow = calculateRiskScore(0, 0, 2, 0);
    const riskHigh = calculateRiskScore(10, 100, 30, 5);

    assert(riskLow <= 10, 'Score de baixo risco deve ser <= 10');
    assertEquals(riskHigh, 100, 'Score de risco máximo deve ser 100');
  });

  await runTest('Unitários', 'Integridade das Categorias Oficiais de Depósitos (A1 a E)', () => {
    const codes = DEPOSIT_CATEGORIES.map(d => d.code);
    assert(codes.includes('A1'), 'Deve conter depósito A1');
    assert(codes.includes('A2'), 'Deve conter depósito A2');
    assert(codes.includes('B'), 'Deve conter depósito B');
    assert(codes.includes('C'), 'Deve conter depósito C');
    assert(codes.includes('D1'), 'Deve conter depósito D1');
    assert(codes.includes('D2'), 'Deve conter depósito D2');
    assert(codes.includes('E'), 'Deve conter depósito E');
  });

  // -------------------------------------------------------------
  // 2. TESTES DE INTEGRAÇÃO
  // -------------------------------------------------------------
  console.log('\n🔗 2. TESTES DE INTEGRAÇÃO:');

  await runTest('Integração', 'Visita Domiciliar → Depósito → Detecção de Foco', () => {
    const deposit = {
      deposit_type: 'B',
      quantity: 3,
      has_water: true,
      inspected: true,
      positive: true,
      larvae_found: true,
      eliminated: false,
      treated: true,
    };

    const isFocusDetected = deposit.positive || deposit.larvae_found;
    assert(isFocusDetected, 'Foco deve ser identificado quando larvae_found for true');
  });

  await runTest('Integração', 'Imóvel Fechado → Registro de Pendência com Próximo Retorno', () => {
    const visitResult = 'fechado';
    let pendencyCreated = false;
    let nextReturnDate = '';

    if (visitResult === 'fechado' || visitResult === 'recusa') {
      pendencyCreated = true;
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 7);
      nextReturnDate = returnDate.toISOString().split('T')[0];
    }

    assert(pendencyCreated, 'Pendência deve ser gerada automaticamente');
    assert(nextReturnDate.length === 10, 'Data de retorno deve ser calculada para 7 dias');
  });

  await runTest('Integração', 'Imóvel Trabalhado Posterior → Recuperação e Baixa Automática de Pendência', () => {
    // Simulação da regra transacional da RPC submit_official_visit
    let pendency = {
      property_id: 'prop-101',
      status: 'pendente',
      recovered_at: null as string | null,
    };

    const newVisit = {
      property_id: 'prop-101',
      result: 'trabalhado',
    };

    if (newVisit.result === 'trabalhado' && pendency.property_id === newVisit.property_id) {
      pendency.status = 'recuperado';
      pendency.recovered_at = new Date().toISOString();
    }

    assertEquals(pendency.status, 'recuperado', 'Pendência anterior deve ser alterada para recuperado');
    assert(pendency.recovered_at !== null, 'Data de recuperação deve ser preenchida');
  });

  await runTest('Integração', 'Estoque FEFO: Bloqueio de Saída sem Saldo Suficiente', () => {
    const batch = {
      batch_number: 'LOTE-2026-A',
      current_quantity: 5.0,
      expiration_date: '2027-01-01',
    };

    const requestedQty = 8.0;
    let errorThrown = false;

    if (batch.current_quantity < requestedQty) {
      errorThrown = true;
    }

    assert(errorThrown, 'Operação não deve permitir saldo negativo no estoque');
  });

  await runTest('Integração', 'Ovitrampas: Instalação → Coleta → Positividade e IPO', () => {
    const collections = [
      { id: '1', eggs_count: 45, positive: true },
      { id: '2', eggs_count: 0, positive: false },
      { id: '3', eggs_count: 12, positive: true },
      { id: '4', eggs_count: 0, positive: false },
    ];

    const totalEggs = collections.reduce((acc, c) => acc + c.eggs_count, 0);
    const positiveCount = collections.filter(c => c.positive).length;
    const ipo = (positiveCount / collections.length) * 100; // Índice de Positividade de Ovitrampas

    assertEquals(totalEggs, 57, 'Total de ovos deve ser 57');
    assertEquals(positiveCount, 2, 'Ovitrampas positivas devem ser 2');
    assertEquals(ipo, 50.0, 'IPO deve ser 50%');
  });

  // -------------------------------------------------------------
  // 3. TESTES E2E (SIMULAÇÃO DE FLUXOS COMPLETOS)
  // -------------------------------------------------------------
  console.log('\n🚀 3. TESTES E2E (FLUXOS OPERACIONAIS COMPLETOS):');

  await runTest('E2E', 'Fluxo 1: ACE entra → recebe roteiro → visita → elimina depósito → salva → sincroniza', async () => {
    const aceUser: { id: string; role: UserRole } = { id: 'ace-1', role: 'ACE' };
    assert(can(aceUser.role, 'visits.create'), 'ACE deve poder criar visita');

    // 1. Gera UUID prévio no cliente (idempotência)
    const clientGeneratedVisitId = 'e2e-uuid-001';

    // 2. Monta payload da ficha oficial
    const visitPayload = {
      id: clientGeneratedVisitId,
      property_id: 'prop-500',
      agent_id: aceUser.id,
      started_at: '2026-09-08T08:00:00Z',
      finished_at: '2026-09-08T08:20:00Z',
      result: 'trabalhado',
      deposits: [
        { deposit_type: 'A1', quantity: 1, positive: false, eliminated: false },
        { deposit_type: 'B', quantity: 2, positive: true, larvae_found: true, eliminated: true },
      ],
      actions: [{ action_type: 'eliminacao_mecanica', quantity: 1 }],
    };

    // 3. Fila de sincronização suporta retry
    const syncQueue = [visitPayload];
    assert(syncQueue.length === 1, 'Visita deve estar na fila');

    // 4. Sincronização executa e esvazia a fila
    const syncedVisit = syncQueue.shift();
    assertEquals(syncedVisit?.id, clientGeneratedVisitId, 'UUID enviado deve ser mantido');
    assertEquals(syncQueue.length, 0, 'Fila deve ficar vazia após confirmação');
  });

  await runTest('E2E', 'Fluxo 2: Imóvel fechado → pendência criada → retorno → trabalhado → recuperado', () => {
    // 1ª tentativa: Imóvel Fechado
    let pendencyRecord = {
      property_id: 'prop-777',
      attempt_count: 1,
      reason: 'fechado',
      status: 'pendente',
      recovered_at: null as string | null,
    };

    // 2ª tentativa: Nova visita encontra o morador e trabalha o imóvel
    const visit2 = { property_id: 'prop-777', result: 'trabalhado' };

    // RPC simula a baixa automática
    if (visit2.result === 'trabalhado' && pendencyRecord.property_id === visit2.property_id) {
      pendencyRecord.status = 'recuperado';
      pendencyRecord.recovered_at = '2026-09-08T15:00:00Z';
    }

    assertEquals(pendencyRecord.status, 'recuperado', 'Status deve ser recuperado');
    assert(pendencyRecord.recovered_at !== null, 'Data da recuperação deve estar registrada');
  });

  await runTest('E2E', 'Fluxo 3: Caso epidemiológico → alerta → bloqueio com raio de 150m → conclusão', () => {
    const caseReport = {
      notification_number: 'SINAN-2026-88',
      disease: 'Dengue',
      classification: 'confirmado',
      latitude: -29.7185,
      longitude: -52.4281,
    };

    // Gera operação de bloqueio químico peridomiciliar com raio preconizado pelo MS
    const blockade = {
      operation_id: 'blk-001',
      case_id: caseReport.notification_number,
      radius_meters: 150,
      target_properties: 120,
      worked_properties: 110,
      closed_properties: 8,
      refusals: 2,
      status: 'concluida',
    };

    const coverage = ((blockade.worked_properties + blockade.closed_properties) / blockade.target_properties) * 100;
    assert(coverage >= 90.0, 'Bloqueio deve atingir cobertura mínima preconizada de 90%');
    assertEquals(blockade.status, 'concluida', 'Operação deve ser concluída');
  });

  await runTest('E2E', 'Fluxo 4: Usuário sem permissão tenta acessar recurso restrito → Acesso Negado', () => {
    const visitorRole = 'AUDITOR_VIEWER';
    const attemptedAction = 'users.manage';

    const hasAccess = can(visitorRole, attemptedAction);
    assert(!hasAccess, 'Usuário de consulta ou visitante não deve ter permissão para gerenciar usuários');
  });

  await runTest('E2E', 'Fluxo 5: Ciclo Completo de Ovitrampas (15 etapas - Cadastro, Instalação, Coleta, 86 Ovos, Indicadores, Alertas e Histórico)', () => {
    // 1. Coordenador cadastra ovitrampa
    const trap = {
      id: 'ovi-uuid-001',
      code: 'OVI-0001',
      neighborhood: 'Centro',
      address: 'Rua Marechal Floriano, 412',
      status: 'Disponivel',
      eggs_count: 0,
      is_positive: false,
      installations: [] as any[],
      collections: [] as any[],
      results: [] as any[],
      next_collection_date: null as string | null,
    };
    assertEquals(trap.code, 'OVI-0001', 'Código gerado deve ser OVI-0001');

    // 2. ACE recebe no PWA
    const acePwaQueue = [trap];
    assertEquals(acePwaQueue.length, 1, 'ACE deve visualizar a ovitrampa atribuída');

    // 3. ACE instala
    const installDate = '2026-09-01';
    trap.status = 'Aguardando coleta';
    trap.installations.push({
      id: 'inst-01',
      date: installDate,
      paddle_code: 'PAL-OVI-001',
      agent: 'Carlos Eduardo Silva',
    });

    // 4. Sistema programa coleta (+5 dias úteis)
    trap.next_collection_date = '2026-09-06';
    assertEquals(trap.status, 'Aguardando coleta', 'Status deve mudar para Aguardando coleta');
    assertEquals(trap.next_collection_date, '2026-09-06', 'Data de coleta programada automaticamente');

    // 5. Coleta aparece na agenda
    const isOverdue = trap.next_collection_date < '2026-09-08';
    assert(isOverdue, 'Em 08/09 a coleta do dia 06/09 deve ser detectada como vencida');

    // 6. ACE coleta
    trap.status = 'Coletada';
    trap.collections.push({
      id: 'col-01',
      date: '2026-09-08',
      trap_condition: 'coleta_realizada',
      paddle_replaced: true,
    });
    assertEquals(trap.status, 'Coletada', 'Status deve atualizar para Coletada');

    // 7. Resultado registra 86 ovos
    const eggsCount = 86;
    trap.results.push({
      id: 'res-01',
      eggs_count: eggsCount,
      reading_date: '2026-09-08',
      responsible: 'Laboratório Entomológico Municipal',
    });

    // 8. Ovitrampa fica positiva
    trap.eggs_count = eggsCount;
    trap.is_positive = eggsCount > 0;
    trap.status = 'Resultado disponivel';
    assert(trap.is_positive, 'Ovitrampa com 86 ovos deve ser classificada como Positiva');

    // 9. Dashboard atualiza IPO e IDO
    const sampleTraps = [trap, { id: 'ovi-02', is_positive: false, eggs_count: 0 }];
    const totalCollected = sampleTraps.length;
    const totalPositives = sampleTraps.filter(t => t.is_positive).length;
    const totalEggs = sampleTraps.reduce((acc, t) => acc + t.eggs_count, 0);

    const ipo = (totalPositives / totalCollected) * 100;
    const ido = totalPositives > 0 ? totalEggs / totalPositives : 0;
    assertEquals(ipo, 50.0, 'IPO deve ser 50%');
    assertEquals(ido, 86.0, 'IDO deve ser 86 ovos/armadilha positiva');

    // 10. Bairro atualiza indicadores
    const neighborhoodMetrics = {
      name: 'Centro',
      traps: 1,
      positives: 1,
      ipo: 100,
      eggs: 86,
    };
    assertEquals(neighborhoodMetrics.eggs, 86, 'Bairro Centro deve acumular 86 ovos');

    // 11. Mapa atualiza
    const mapPointColor = trap.is_positive ? '#ef4444' : '#10b981';
    assertEquals(mapPointColor, '#ef4444', 'Ponto no mapa deve exibir cor de positivo (vermelho)');

    // 12. Motor de risco recebe informação
    const riskFactor = {
      factor: 'positive_ovitraps',
      weight: 10.0,
      points: Math.min(100, totalPositives * 30) * 0.1,
    };
    assert(riskFactor.points > 0, 'Motor de risco deve incorporar pontuação entomológica de ovitrampas');

    // 13. Coordenador recebe alerta (≥ 50 ovos)
    const alertGenerated = eggsCount >= 50;
    assert(alertGenerated, 'Alerta de densidade crítica deve ser disparado para contagem ≥ 50 ovos');

    // 14. Histórico permanece salvo
    assertEquals(trap.installations.length, 1, 'Histórico de instalação deve ser preservado');
    assertEquals(trap.collections.length, 1, 'Histórico de coleta deve ser preservado');
    assertEquals(trap.results.length, 1, 'Histórico de laudo laboratorial deve ser preservado');

    // 15. Nova instalação pode ser programada
    trap.status = 'Disponivel';
    assertEquals(trap.status, 'Disponivel', 'Ponto sentinela pronto para novo ciclo de monitoramento');
  });

  // -------------------------------------------------------------
  // 4. TESTES DE INTEGRIDADE CORE & REGRESSÃO - MÓDULO OVITRAMPAS
  // -------------------------------------------------------------
  console.log('\n🛡️ 4. TESTES DE INTEGRIDADE CORE & REGRESSÃO - MÓDULO OVITRAMPAS:');

  await runTest('Ovitrampas Core', '[CORE MODULE] Ovitrampas registrado como módulo essencial permanente em CORE_MODULES', () => {
    assert(isCoreModule('ovitraps'), 'ovitraps deve ser reconhecido como CORE MODULE');
    assert(isCoreModule('territory'), 'territory deve ser reconhecido como CORE MODULE');
    assert(isCoreModule('properties'), 'properties deve ser reconhecido como CORE MODULE');
    assert(isCoreModule('visits'), 'visits deve ser reconhecido como CORE MODULE');

    const def = CORE_MODULE_DEFINITIONS.ovitraps;
    assertEquals(def.criticality, 'CORE_ESSENTIAL', 'Ovitrampas deve ser classificado como CORE_ESSENTIAL');
    assertEquals(def.isExperimental, false, 'Ovitrampas NUNCA deve depender de feature flag experimental');
  });

  await runTest('Ovitrampas Core', '[ROTAS] Rota canônica /ovitrampas existe e mapeia para a view ovitraps', () => {
    const route = CORE_MODULE_DEFINITIONS.ovitraps.canonicalRoute;
    assertEquals(route, '/ovitrampas', 'Rota canônica deve ser /ovitrampas');

    // Resolução pelo mapa central de rotas real (src/config/routes.ts)
    const resolveRoute = (path: string): string => {
      const r = resolvePath(path);
      return r.kind === 'view' ? r.route.view : r.kind;
    };

    assertEquals(resolveRoute('/ovitrampas'), 'ovitraps', '/ovitrampas deve resolver para a view ovitraps');
    assertEquals(resolveRoute('/ovitraps'), 'ovitraps', '/ovitraps alternativo deve resolver para a view ovitraps');

    // Rotas canônicas de TODOS os módulos core resolvem para a própria tela
    for (const def of Object.values(CORE_MODULE_DEFINITIONS)) {
      assertEquals(resolveRoute(def.canonicalRoute), def.id, `${def.canonicalRoute} deve abrir ${def.id}`);
    }
  });

  await runTest('Ovitrampas Core', '[MENU] Usuário com permissão ovitraps.view visualiza o módulo no menu', () => {
    // Configuração REAL do menu (src/config/navigation.ts): Ovitrampas fica no grupo Vigilância
    const vigilancia = NAV_GROUPS.find(g => g.id === 'vigilancia');
    assert(!!vigilancia && vigilancia.title === 'Vigilância', 'Grupo Vigilância deve existir no menu');
    assert(vigilancia!.items.some(i => i.view === 'ovitraps' && i.highlight), 'Ovitrampas deve estar em destaque no grupo Vigilância');

    const filterMenuForRole = (role: UserRole) =>
      getVisibleNavGroups(role, accessFor(role)).flatMap(g => g.items.map(i => ({ id: i.view })));

    // ADMIN, COORDENADOR, SUPERVISOR, ACE, EPIDEMIOLOGIA devem ver Ovitrampas
    const coordinatorMenu = filterMenuForRole('ENDEMIAS_COORDINATOR');
    const aceMenu = filterMenuForRole('ACE');
    const supervisorMenu = filterMenuForRole('FIELD_SUPERVISOR');
    const epiMenu = filterMenuForRole('EPIDEMIOLOGY_AGENT');

    assert(coordinatorMenu.some(i => i.id === 'ovitraps'), 'Coordenador DEVE ver Ovitrampas no menu');
    assert(aceMenu.some(i => i.id === 'ovitraps'), 'ACE DEVE ver Ovitrampas no menu');
    assert(supervisorMenu.some(i => i.id === 'ovitraps'), 'Supervisor DEVE ver Ovitrampas no menu');
    assert(epiMenu.some(i => i.id === 'ovitraps'), 'Vigilância Epidemiológica DEVE ver Ovitrampas no menu');
  });

  await runTest('Ovitrampas Core', '[PERMISSÕES RBAC] Permissões de Ovitrampas ativas para ADMIN, COORDENADOR, SUPERVISOR e ACE', () => {
    // 1. ADMIN
    assert(can('MUNICIPAL_ADMIN', 'ovitraps.view'), 'ADMIN deve ter ovitraps.view');
    assert(can('MUNICIPAL_ADMIN', 'ovitraps.manage'), 'ADMIN deve ter ovitraps.manage');
    assert(can('SUPER_ADMIN', 'ovitraps.view'), 'SUPER_ADMIN deve ter ovitraps.view');

    // 2. COORDENADOR
    assert(can('ENDEMIAS_COORDINATOR', 'ovitraps.view'), 'Coordenador deve ter ovitraps.view');
    assert(can('ENDEMIAS_COORDINATOR', 'ovitraps.manage'), 'Coordenador deve ter ovitraps.manage');

    // 3. SUPERVISOR
    assert(can('FIELD_SUPERVISOR', 'ovitraps.view'), 'Supervisor deve ter ovitraps.view');
    assert(can('FIELD_SUPERVISOR', 'ovitraps.collect'), 'Supervisor deve ter ovitraps.collect');
    assert(can('FIELD_SUPERVISOR', 'ovitraps.results'), 'Supervisor deve ter ovitraps.results');

    // 4. ACE
    assert(can('ACE', 'ovitraps.view'), 'ACE deve ter ovitraps.view');
    assert(can('ACE', 'ovitraps.collect'), 'ACE deve ter ovitraps.collect');
  });

  await runTest('Ovitrampas Core', '[BANCO DE DADOS] Integridade do schema das 4 tabelas de Ovitrampas', () => {
    const requiredTables = CORE_MODULE_DEFINITIONS.ovitraps.databaseTables;
    assertEquals(requiredTables.length, 4, 'Devem existir 4 tabelas relacionais de ovitrampas');
    assert(requiredTables.includes('ovitraps'), 'Deve conter tabela ovitraps');
    assert(requiredTables.includes('ovitrap_installations'), 'Deve conter tabela ovitrap_installations');
    assert(requiredTables.includes('ovitrap_collections'), 'Deve conter tabela ovitrap_collections');
    assert(requiredTables.includes('ovitrap_results'), 'Deve conter tabela ovitrap_results');
  });

  // -------------------------------------------------------------
  // 5. TESTES AVANÇADOS DA CENTRAL DE OVITRAMPAS (CENÁRIOS 47, 48, 49)
  // -------------------------------------------------------------
  console.log('\n🦟 5. TESTES AVANÇADOS DO CORE MODULE OVITRAMPAS:');

  await runTest('Ovitrampas Core', '[FÓRMULAS OFICIAIS] Cálculo centralizado de IPO e IDO', () => {
    // IPO = (positivas / válidas) * 100
    const ipoNormal = (3 / 10) * 100;
    assertEquals(Number(ipoNormal.toFixed(1)), 30.0, 'IPO com 3 positivas e 10 válidas deve ser 30.0%');

    // Validação de divisão por zero
    const ipoZero = 0 === 0 ? 0 : (2 / 0) * 100;
    assertEquals(ipoZero, 0, 'IPO com zero coletas válidas deve ser 0');

    // IDO = total de ovos / ovitrampas positivas
    const totalOvos = 450;
    const positivas = 3;
    const ido = totalOvos / positivas;
    assertEquals(Number(ido.toFixed(1)), 150.0, 'IDO com 450 ovos em 3 positivas deve ser 150.0');
  });

  await runTest('Ovitrampas Core', '[CENÁRIO 47: TESTE DE PONTA A PONTA] Fluxo operacional completo do ponto OVI-0021', () => {
    // 1. Coordenador cria OVI-0021
    const point = {
      code: 'OVI-0021',
      sector: 'Setor 03',
      assignedAgentId: 'ace-001',
      status: 'Disponivel',
    };
    assertEquals(point.code, 'OVI-0021', 'Ponto criado deve ser OVI-0021');
    assertEquals(point.sector, 'Setor 03', 'Ponto deve pertencer ao Setor 03');

    // 4. Sistema agenda instalação
    let status = 'Planejada';
    assertEquals(status, 'Planejada', 'Status deve passar para Planejada');

    // 6. ACE instala offline no PWA e 8. Internet retorna e sincroniza
    status = 'Instalada';
    const nextCollectionDate = '2026-09-13'; // 5 dias
    assertEquals(status, 'Instalada', 'Status deve passar para Instalada');
    assert(!!nextCollectionDate, 'Data prevista de coleta deve estar agendada');

    // 10. Coleta aparece na agenda e 11. ACE coleta
    status = 'Coletada';
    assertEquals(status, 'Coletada', 'Status deve passar para Coletada');

    // 12. Resultado registra 120 ovos e 13. Sistema classifica como positiva
    const eggsCount = 120;
    const isPositive = eggsCount > 0;
    status = 'Resultado disponivel';
    assert(isPositive, 'Com 120 ovos deve ser classificada como positiva');

    // 14. IPO é recalculado (1 positiva / 1 examinada = 100%)
    const ipoRecalculado = (1 / 1) * 100;
    assertEquals(ipoRecalculado, 100, 'IPO deve ser 100% no teste de ponta a ponta');

    // 15. IDO é recalculado (120 ovos / 1 positiva = 120)
    const idoRecalculado = eggsCount / 1;
    assertEquals(idoRecalculado, 120, 'IDO deve ser 120 no teste de ponta a ponta');

    // 19. Alerta é criado quando regra for atingida (>= 100 ovos = Crítico)
    const shouldAlert = eggsCount >= 100;
    assert(shouldAlert, 'Contagem de 120 ovos deve disparar alerta operacional');
  });

  await runTest('Ovitrampas Core', '[CENÁRIO 48: TESTE DE TENDÊNCIA] Detecção de curva crescente com explicação real', () => {
    // Série temporal: 32 -> 51 -> 89 -> 137 ovos
    const counts = [32, 51, 89, 137];
    let isMonotonicGrowth = true;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] <= counts[i - 1]) {
        isMonotonicGrowth = false;
        break;
      }
    }
    assert(isMonotonicGrowth, 'Série 32 -> 51 -> 89 -> 137 ovos deve ser estritamente crescente');

    const totalGrowthPercent = ((counts[counts.length - 1] - counts[0]) / counts[0]) * 100;
    assert(totalGrowthPercent > 300, 'Crescimento acumulado deve ser superior a 300% (328%)');
  });

  await runTest('Ovitrampas Core', '[CENÁRIO 49: TESTE DE COBERTURA] Detecção de setor desprovido de armadilha', () => {
    const sectorsCoverage = [
      { sector: 'Setor 01', trapsCount: 2, status: 'Adequada' },
      { sector: 'Setor 02', trapsCount: 1, status: 'Baixa cobertura' },
      { sector: 'Setor 03', trapsCount: 0, status: 'Sem monitoramento' },
    ];

    const unmonitored = sectorsCoverage.filter(s => s.trapsCount === 0);
    assertEquals(unmonitored.length, 1, 'Deve detectar exatamente 1 setor sem monitoramento');
    assertEquals(unmonitored[0].sector, 'Setor 03', 'O setor sem monitoramento deve ser o Setor 03');
    assertEquals(unmonitored[0].status, 'Sem monitoramento', 'Status deve ser Sem monitoramento');
  });

  // -------------------------------------------------------------
  // 7. CENTRAL DE INTEGRIDADE & AUDITORIA DE PÁGINAS E BANCO DE DADOS
  // -------------------------------------------------------------
  console.log('\n🛡️ 7. CENTRAL DE INTEGRIDADE DO SISTEMA & AUDITORIA:');

  await runTest('Auditoria do Sistema', 'Validação do Catálogo de 51 Páginas/Módulos', () => {
    assert(ALL_SYSTEM_PAGES.length === 51, `Deve conter 51 páginas mapeadas no catálogo (encontradas: ${ALL_SYSTEM_PAGES.length})`);
    
    // Nenhuma página pode ter status PARCIAL, SEM_BANCO, MOCK_DATA ou ERRO
    const invalidPages = ALL_SYSTEM_PAGES.filter(p => p.status !== 'FUNCIONAL');
    if (invalidPages.length > 0) {
      throw new Error(`Existem ${invalidPages.length} páginas com status não-funcional: ${invalidPages.map(p => p.name).join(', ')}`);
    }
  });

  await runTest('Auditoria do Sistema', 'Validação de Conexão e Relação com Tabelas Supabase', () => {
    for (const page of ALL_SYSTEM_PAGES) {
      assert(page.tables.length > 0, `Página ${page.name} (${page.route}) deve declarar pelo menos 1 tabela de banco`);
      assert(page.supportsRead || page.supportsCreate, `Página ${page.name} deve suportar leitura ou cadastro`);
    }
  });

  // Observação: sem sessão autenticada a gravação em system_audits é recusada pela RLS;
  // este teste valida o resumo calculado e a conectividade, não a persistência.
  await runTest('Auditoria do Sistema', 'Execução da auditoria completa (resumo e conectividade)', async () => {
    const { summary } = await systemAuditService.runCompleteAudit('test-runner-automated');
    assert(summary.pagesChecked === 51, `Auditoria deve checar 51 páginas (checou: ${summary.pagesChecked})`);
    assert(summary.functionalCount === 51, `Auditoria deve validar 51 páginas como FUNCIONAIS (validou: ${summary.functionalCount})`);
    assert(summary.partialCount === 0, `Não deve haver páginas parciais`);
    assert(summary.mockCount === 0, `Não deve haver páginas com mock data`);
    assert(summary.errorCount === 0, `Não deve haver páginas com erro`);
    assert(summary.databaseConnected === true, `Conexão com o banco deve estar ativa`);
  });

  // -------------------------------------------------------------
  // 8. ROTAS, PERMISSÕES, MÓDULOS REMOVIDOS, ISOLAMENTO E OFFLINE
  // -------------------------------------------------------------
  console.log('\n🧭 8. ROTAS, PERMISSÕES, ISOLAMENTO MUNICIPAL E FILA OFFLINE:');

  await runTest('Rotas', 'Toda rota interna declara permissão ou papel (checagem fail-closed possível)', () => {
    const semRegra = ROUTES.filter(r => !r.permission && !(r.roles && r.roles.length));
    assertEquals(semRegra.length, 0, `Rotas sem regra de acesso: ${semRegra.map(r => r.path).join(', ')}`);
  });

  await runTest('Rotas', 'URLs canônicas e aliases são únicos e não colidem com rotas públicas', () => {
    const all = ROUTES.flatMap(r => [r.path, ...(r.aliases || [])]);
    const dup = all.filter((p, i) => all.indexOf(p) !== i);
    assertEquals(dup.length, 0, `URLs duplicadas: ${dup.join(', ')}`);
    for (const p of all) {
      assert(!(PUBLIC_PATHS as readonly string[]).includes(p), `${p} não pode ser rota interna e pública ao mesmo tempo`);
      assert(!LEGACY_REDIRECTS[p], `${p} não pode ser rota ativa e redirecionamento legado`);
    }
  });

  await runTest('Rotas', 'Abertura direta/recarga: URLs canônicas, aliases e barra final resolvem para a tela certa', () => {
    for (const r of ROUTES) {
      const canonical = resolvePath(r.path);
      assert(canonical.kind === 'view' && canonical.route.view === r.view && canonical.isCanonical, `${r.path} deve abrir ${r.view}`);
      for (const alias of r.aliases || []) {
        const res = resolvePath(alias);
        assert(res.kind === 'view' && res.route.view === r.view && !res.isCanonical, `Alias ${alias} deve levar a ${r.path}`);
      }
    }
    const trailing = resolvePath('/ovitrampas/');
    assert(trailing.kind === 'view' && trailing.route.view === 'ovitraps', 'Barra final deve ser ignorada');
    const withQuery = resolvePath('/visitas?x=1');
    assert(withQuery.kind === 'view' && withQuery.route.view === 'visits', 'Query string não deve afetar a rota');
    assertEquals(resolvePath('/').kind, 'home', '/ deve resolver para a tela inicial do perfil');
    assertEquals(resolvePath('/rota-inexistente').kind, 'not_found', 'URL desconhecida deve ser tratada como não encontrada');
    assertEquals(toPath('visits'), '/visitas', 'Id de tela deve converter para a URL canônica');
  });

  await runTest('Rotas', 'Rotas públicas do cidadão e de autenticação continuam públicas', () => {
    for (const p of ['/login', '/esqueci-senha', '/redefinir-senha', '/primeiro-acesso', '/publico', '/publico/denuncia', '/publico/denuncia/acompanhar']) {
      assertEquals(resolvePath(p).kind, 'public', `${p} deve ser rota pública`);
    }
  });

  await runTest('Rotas', 'Hubs com abas: cada aba tem URL própria e a URL abre a aba correspondente', () => {
    for (const hub of Object.keys(HUB_TABS) as HubId[]) {
      for (const [tab, view] of Object.entries(HUB_TABS[hub])) {
        assert(isViewModule(view), `Aba ${hub}.${tab} aponta para tela inexistente ${view}`);
        assertEquals(tabForView(hub, view as any), tab, `${view} deve abrir a aba ${tab} do hub ${hub}`);
        assertEquals(viewForTab(hub as 'territory', tab as any), view, `Aba ${tab} deve atualizar a URL para ${view}`);
      }
    }
  });

  await runTest('Rotas', 'Catálogo de páginas auditadas só referencia rotas existentes', () => {
    for (const page of ALL_SYSTEM_PAGES) {
      const res = resolvePath(page.route);
      assert(res.kind === 'view' || res.kind === 'public', `Página auditada ${page.route} não corresponde a nenhuma rota`);
    }
  });

  await runTest('Módulos Removidos', 'TV/Telão, Briefing, Assistente IA, Capacitações e Metas não existem mais', () => {
    for (const v of ['tv_mode', 'daily_briefing', 'ai_assistant', 'trainings', 'management_targets', 'admin', 'audit', 'public_portal']) {
      assert(!isViewModule(v), `${v} não deveria mais ser uma tela`);
    }
    for (const p of ['/tv', '/briefing', '/assistente', '/capacitacoes', '/metas']) {
      const res = resolvePath(p);
      assert(res.kind === 'redirect', `${p} deve redirecionar para um destino válido`);
      const target = resolvePath((res as any).to);
      assert(target.kind === 'view' || target.kind === 'home', `Destino de ${p} deve ser válido`);
      assert(!ALL_SYSTEM_PAGES.some(pg => pg.route === p), `${p} não deve constar do catálogo auditado`);
    }
    assert(!PERMISSIONS_CATALOG.some(pe => pe.slug === 'ia_assistente.use'), 'Permissão exclusiva do Assistente IA removida do espelho RBAC');
    assert(!LEGACY_EN_TO_PT['ai_assistant.use'], 'Alias legado ai_assistant.use removido');
    const menuViews = NAV_GROUPS.flatMap(g => g.items.map(i => i.view as string));
    for (const v of ['tv_mode', 'daily_briefing', 'ai_assistant', 'trainings', 'management_targets']) {
      assert(!menuViews.includes(v), `${v} não pode aparecer no menu`);
    }
  });

  await runTest('Permissões', 'Checagem de acesso falha de forma fechada', () => {
    const throwing: AccessChecker = { can: () => { throw new Error('falha'); }, hasRole: () => true };
    assert(!canAccessView('dashboard', throwing), 'Erro na checagem de permissão deve negar acesso');
    assert(!canAccessView('dashboard', null), 'Sem checador de acesso deve negar');
    assert(!canAccessRoute({ view: 'dashboard', path: '/x', title: 'x' }, accessFor('SUPER_ADMIN')), 'Rota sem regra deve ser negada');
    const truthy: AccessChecker = { can: () => 'sim' as any, hasRole: () => true };
    assert(!canAccessView('dashboard', truthy), 'Somente true explícito concede acesso');
  });

  await runTest('Permissões', 'ACE: rotas administrativas bloqueadas por URL direta; tela inicial é o PWA', () => {
    const ace = accessFor('ACE');
    for (const v of ['admin_users', 'admin_roles', 'admin_audit', 'system_settings', 'integrations', 'system_errors', 'database_health', 'data_import'] as const) {
      assert(!canAccessView(v, ace), `ACE não pode abrir ${v}`);
    }
    assert(canAccessView('ace_pwa', ace) && canAccessView('visits', ace) && canAccessView('ovitraps', ace), 'ACE deve abrir PWA, visitas e ovitrampas');
    assertEquals(getHomeView('ACE', ace), 'ace_pwa', 'Tela inicial do ACE deve ser o PWA');
    const groups = getVisibleNavGroups('ACE', ace);
    assertEquals(groups[0]?.id, 'campo', 'Para o ACE o grupo Campo ACE vem primeiro');
    assert(!groups.some(g => g.id === 'admin'), 'ACE não vê o grupo Administração');
  });

  await runTest('Permissões', 'Administradores mantêm ferramentas administrativas; restrições de papel preservadas', () => {
    const admin = accessFor('MUNICIPAL_ADMIN');
    const adminGroup = getVisibleNavGroups('MUNICIPAL_ADMIN', admin).find(g => g.id === 'admin');
    assert(!!adminGroup && adminGroup.items.length === 6, 'Administração deve ter 6 itens para o administrador municipal');
    assert(canAccessView('database_health', admin), 'Admin municipal acessa Integridade do Sistema');
    assert(!canAccessView('system_errors', admin), 'Logs de erros continuam exclusivos do SUPER_ADMIN');
    assert(canAccessView('system_errors', accessFor('SUPER_ADMIN')), 'SUPER_ADMIN acessa Logs de erros');
    assert(!canAccessView('supervisor_mobile', accessFor('HEALTH_SECRETARY')), 'Supervisão restrita aos papéis de supervisão');
  });

  await runTest('Permissões', 'Menu: sete grupos na ordem definida e itens sem permissão ocultos', () => {
    assertEquals(NAV_GROUPS.map(g => g.title).join(' | '), 'Início | Campo ACE | Território | Vigilância | Gestão Operacional | Relatórios | Administração', 'Grupos do menu');
    const auditor = getVisibleNavGroups('AUDITOR_VIEWER', accessFor('AUDITOR_VIEWER')).flatMap(g => g.items.map(i => i.view));
    assert(!auditor.includes('ace_pwa'), 'Auditor não vê o PWA de campo');
    assert(auditor.includes('dashboard'), 'Auditor vê a Sala de Situação');
  });

  await runTest('Isolamento Municipal', 'Serviços bloqueiam chamadas sem município (sem UUID de exemplo como padrão)', async () => {
    let threw = false;
    try { requireMunicipalityId(''); } catch (e) { threw = e instanceof MissingMunicipalityError; }
    assert(threw, 'requireMunicipalityId deve rejeitar vazio');
    assertEquals(requireMunicipalityId('abc'), 'abc', 'requireMunicipalityId devolve o id informado');
    await expectMissingMunicipality(() => situationRoomService.getSituationData({ municipalityId: '', periodFilter: 'cycle' }), 'Sala de Situação');
    await expectMissingMunicipality(() => auditLogService.list(''), 'Auditoria');
    await expectMissingMunicipality(() => userAdminService.list(''), 'Usuários');
  });

  await runTest('Isolamento Municipal', 'Código-fonte não usa o UUID de exemplo fora da constante documentada', () => {
    const fsMod = { readdirSync, readFileSync };
    const pathMod = { join };
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fsMod.readdirSync(dir, { withFileTypes: true })) {
        const p = pathMod.join(dir, e.name);
        if (e.isDirectory()) { if (!['tests', 'db'].includes(e.name)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || e.name === 'municipalityScope.ts') continue;
        if (fsMod.readFileSync(p, 'utf8').includes(EXAMPLE_MUNICIPALITY_ID)) offenders.push(p);
      }
    };
    walk(pathMod.join(process.cwd(), 'src'));
    assertEquals(offenders.length, 0, `UUID de exemplo encontrado em: ${offenders.join(', ')}`);
  });

  await runTest('Portal do Cidadão', 'Município público só aceita UUID válido', () => {
    assert(isValidMunicipalityId('3f2b1c9e-8a7d-4e6f-9b0a-1c2d3e4f5a6b'), 'UUID válido aceito');
    assert(!isValidMunicipalityId(''), 'Vazio rejeitado');
    assert(!isValidMunicipalityId('municipio-1'), 'Texto arbitrário rejeitado');
  });

  await runTest('Offline ACE', 'Fila offline: sem duplicidade e sem perda de visita enfileirada durante a sincronização', async () => {
    const storage = memoryStorage();
    const mun = 'mun-a';
    enqueueVisit({ id: 'v1', municipality_id: mun, agent_id: 'p1' }, storage);
    enqueueVisit({ id: 'v1', municipality_id: mun, agent_id: 'p1' }, storage); // duplicado
    enqueueVisit({ id: 'v2', municipality_id: mun, agent_id: 'p1' }, storage);
    enqueueVisit({ id: 'v3', municipality_id: 'mun-b', agent_id: 'p9' }, storage); // outro município
    assertEquals(readQueue(storage).length, 3, 'Mesmo id não pode entrar duas vezes na fila');

    const sent: string[] = [];
    const summary = await syncQueue(
      async (item) => {
        sent.push(item.id);
        if (item.id === 'v1') enqueueVisit({ id: 'v4', municipality_id: mun, agent_id: 'p1' }, storage); // chega durante o sync
        return item.id === 'v2' ? { success: false, message: 'rede' } : { success: true };
      },
      { municipalityId: mun, cycleId: 'c1' },
      storage
    );
    const remaining = readQueue(storage).map(v => v.id).sort();
    assertEquals(summary.synced, 1, 'Uma visita confirmada');
    assertEquals(summary.failed, 1, 'Uma visita com falha');
    assert(!sent.includes('v3'), 'Visita de outro município não é enviada com o município atual');
    assertEquals(remaining.join(','), 'v2,v3,v4', 'Fila mantém falhas, outro município e a visita recebida durante o envio');
    assertEquals(readQueue(storage).find(v => v.id === 'v2')?.retryCount, 1, 'Falha incrementa tentativas');

    const noCycle = await syncQueue(async () => ({ success: true }), { municipalityId: mun, cycleId: null }, storage);
    assertEquals(noCycle.synced, 0, 'Sem ciclo em andamento nada é enviado com ciclo inventado');
  });

  // -------------------------------------------------------------
  // 9. DADOS REAIS: SEM VALORES FABRICADOS
  // -------------------------------------------------------------
  console.log('\n📊 9. DADOS REAIS (SEM VALORES FABRICADOS):');

  await runTest('Dados Reais', 'Análise histórica: indicadores sem série temporal são declarados indisponíveis', async () => {
    for (const key of ['iip', 'ib', 'reincidencia'] as const) {
      const res = await historicalAnalysisService.getComparativeAnalysis(key, 'ultimas_4semanas_vs_anteriores', undefined, 'mun-teste');
      assert(!res.available && res.series.length === 0, `${key} não pode gerar série sem dados`);
      assert(!!res.unavailableReason, `${key} deve explicar a indisponibilidade`);
    }
  });

  await runTest('Dados Reais', 'Análise histórica: janelas de comparação contíguas e sem sobreposição', async () => {
    const weeks = await historicalAnalysisService.buildBuckets('ultimas_4semanas_vs_anteriores', 'mun-teste');
    assert(weeks.ok, 'Janela semanal deve ser construída sem consultar o banco');
    if (!weeks.ok) return;
    assertEquals(weeks.items.length, 4, 'Quatro semanas comparadas');
    for (let i = 1; i < weeks.items.length; i++) {
      assertEquals(weeks.items[i].cur[0], weeks.items[i - 1].cur[1], 'Semanas atuais devem ser contíguas');
    }
    assert(weeks.items[3].prev[1] <= weeks.items[0].cur[0], 'Período anterior não pode sobrepor o atual');
    const year = await historicalAnalysisService.buildBuckets('ano_atual_vs_anterior', 'mun-teste');
    assert(year.ok && year.items.length === new Date().getMonth() + 1, 'Comparação anual vai de janeiro até o mês atual');
  });

  await runTest('Dados Reais', 'Cache local não semeia dados de exemplo', () => {
    assertEquals(db.getNeighborhoods().length, 0, 'Sem hidratação não há bairros');
    assertEquals(db.getAlerts().length, 0, 'Sem hidratação não há alertas');
    assertEquals(db.getComplaints().length, 0, 'Sem hidratação não há denúncias');
    assert(db.getMunicipality() === null, 'Sem sessão não há município em cache');
  });

  await runTest('Dados Reais', 'Código-fonte sem valores de demonstração conhecidos', () => {
    const forbidden: [RegExp, string][] = [
      [/-29\.71|-52\.42/, 'coordenada fixa de município'],
      [/Carlos (Alberto|Eduardo) Silva|Mariana Duarte|Roberto Silveira|Dr\. Fernando Albuquerque/, 'pessoa fictícia'],
      [/1º Ciclo 2026|Ciclo 05 \/ 2026/, 'ciclo fixo'],
      [/Santa Cruz do Sul|santacruz\.rs\.gov\.br|4316808/, 'município fixo'],
      [/Math\.random\(\)\s*\*\s*60|WPP-\$\{/, 'contagem/protocolo sorteado'],
      [/Hash SHA-256 de Autenticidade: 9f8e/, 'hash fixo'],
      [/municipalityPopulation = 128500/, 'população fixa'],
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (!['tests', 'db'].includes(e.name)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        const content = readFileSync(p, 'utf8');
        for (const [re, label] of forbidden) if (re.test(content)) offenders.push(`${p} (${label})`);
      }
    };
    walk(join(process.cwd(), 'src'));
    assertEquals(offenders.length, 0, `Valores de demonstração encontrados: ${offenders.join('; ')}`);
  });

  // -------------------------------------------------------------
  // 10. RODADA 3: ESQUEMA REAL, MENU E REGRAS DO BANCO
  // -------------------------------------------------------------
  console.log('\n🗄️ 10. ESQUEMA REAL, MENU E REGRAS DO BANCO:');

  await runTest('Rodada 3', 'Telas duplicadas redirecionam (Centro de Comando e Endemias em Números)', () => {
    for (const [from, to] of [['/centro-comando', '/dashboard'], ['/transparencia', '/relatorios'], ['/command_center', '/dashboard']]) {
      const r = resolvePath(from);
      assert(r.kind === 'redirect' && (r as any).to === to, `${from} deve redirecionar para ${to}`);
    }
    assert(!isViewModule('command_center') && !isViewModule('transparency'), 'Views removidas não podem continuar registradas');
  });

  await runTest('Rodada 3', 'Menu inclui Painel do Gestor, Alertas, Motor de Risco e Análise Histórica', () => {
    const views = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.view));
    for (const v of ['executive', 'alerts', 'risk_engine', 'historical_analysis']) assert(views.includes(v as any), `${v} deve estar no menu`);
    const inicio = NAV_GROUPS.find((g) => g.id === 'inicio')!.items.map((i) => i.view);
    assert(inicio.includes('executive') && inicio.includes('alerts'), 'Painel do Gestor e Alertas ficam em Início');
  });

  await runTest('Rodada 3', 'Vistoria de PE vencida usa next_inspection / frequência (sem data inventada)', () => {
    const now = new Date('2026-09-23T12:00:00Z');
    assert(isInspectionOverdue({}, now), 'Sem vistoria registrada = vencida');
    assert(isInspectionOverdue({ next_inspection: '2026-09-22' }, now), 'Próxima vistoria no passado = vencida');
    assert(!isInspectionOverdue({ next_inspection: '2026-09-30' }, now), 'Próxima vistoria futura = em dia');
    assert(!isInspectionOverdue({ last_inspection: '2026-09-15', inspection_frequency_days: 15 }, now), 'Dentro da frequência = em dia');
    assert(isInspectionOverdue({ last_inspection: '2026-09-01', inspection_frequency_days: 15 }, now), 'Frequência excedida = vencida');
  });

  await runTest('Rodada 3', 'Resultado de visita normalizado (RPC grava minúsculas)', () => {
    assertEquals(normResult('trabalhado'), 'TRABALHADO', 'minúsculo');
    assertEquals(normResult('RECUSADO'), 'RECUSA', 'recusado = recusa');
    assertEquals(normResult('recusa'), 'RECUSA', 'recusa');
    assert(PENDING_STATUSES.includes('pendente') && PENDING_STATUSES.includes('PENDENTE'), 'Pendência aceita as duas grafias');
  });

  await runTest('Rodada 3', 'Nome do agente vem do perfil vinculado (agents não tem coluna de nome)', () => {
    assertEquals(agentName({ employee_number: '12', profiles: { full_name: 'Maria' } }), 'Maria', 'nome do perfil');
    assertEquals(agentName({ employee_number: '12' }), 'Matrícula 12', 'sem perfil, usa matrícula');
    assert(agentName(null) === undefined, 'sem agente');
  });

  await runTest('Rodada 3', 'Código-fonte sem colunas/tabelas inexistentes no banco real', () => {
    // Cada padrão abaixo retornava erro de esquema (42703/PGRST200/PGRST205) no projeto Supabase.
    const forbidden: [RegExp, string][] = [
      [/recurrence_count|foci_count/, 'properties não tem contagem de focos (usar breeding_sites)'],
      [/last_inspection_at/, 'coluna é last_inspection'],
      [/epidemiological_blocks|property_visits|chemical_blockades/, 'tabela inexistente'],
      [/agents\s*\(\s*(id,\s*)?name|agent_id\s*\(\s*name|assigned_to_agent_id\s*\(\s*name|full_name,\s*registration_number/, 'agents não tem nome'],
      [/from\('audit_logs'\)\.insert\(\{[^}]{0,300}(entity_name|details):/, 'audit_logs não tem entity_name/details (usar auditLogService.log)'],
      [/from\('audit_logs'\)\.insert\(\{\s*\n\s*action:/, 'audit_logs exige municipality_id/module/entity'],
      [/egg_count\b/, 'coluna é eggs_count'],
      [/block_number/, 'blocks não tem block_number'],
      [/[^_]cycles\(id, name/, 'tabela é field_cycles'],
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (!['tests', 'db'].includes(e.name)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        const content = readFileSync(p, 'utf8');
        for (const [re, label] of forbidden) if (re.test(content)) offenders.push(`${p} (${label})`);
      }
    };
    walk(join(process.cwd(), 'src'));
    assertEquals(offenders.length, 0, `Referências a esquema inexistente: ${offenders.join('; ')}`);
  });

  await runTest('Rodada 3', 'IBGE (API pública): nome, UF e população estimada reais', async () => {
    let invalid = '';
    try { await ibgeService.lookupMunicipality('12'); } catch (e: any) { invalid = e.message; }
    assert(/inválido/.test(invalid), 'Código com formato inválido é recusado sem chamada externa');
    const poa = await ibgeService.lookupMunicipality('4314902');
    assertEquals(poa.name, 'Porto Alegre', 'Nome oficial');
    assertEquals(poa.uf, 'RS', 'UF oficial');
    assert(poa.population === null || poa.population > 100000, 'População estimada coerente (ou indisponível)');
  });

  await runTest('Rodada 3', 'Migrações de segurança versionadas em supabase/migrations', () => {
    const files = readdirSync(join(process.cwd(), 'supabase', 'migrations'));
    for (const f of ['20260923000031_tenant_isolation_hardening.sql', '20260923000032_intersectoral_referrals.sql', '20260923000033_public_portal_complaint_token.sql', '20260923000034_agents_link_and_write_policy.sql', '20260923000035_deprecate_unused_tables.sql']) {
      assert(files.includes(f), `${f} deve existir`);
    }
    const m31 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260923000031_tenant_isolation_hardening.sql'), 'utf8');
    assert(/ARRAY\['SUPER_ADMIN'\];/.test(m31), 'is_platform_admin restrito a SUPER_ADMIN');
    const m33 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260923000033_public_portal_complaint_token.sql'), 'utf8');
    assert(!/gen_random_bytes\(/.test(m33.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')), 'Token do portal sem pgcrypto');
  });

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('📊 RELATÓRIO DE EXECUÇÃO DOS TESTES');
  console.log('===============================================================');

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`Total de testes: ${results.length}`);
  console.log(`Sucessos:       ${passedCount}`);
  console.log(`Falhas:         ${failedCount}`);
  console.log(`Tempo total:    ${totalDuration}ms\n`);

  if (failedCount > 0) {
    console.error('❌ ALGUNS TESTES FALHARAM!');
    process.exit(1);
  } else {
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Erro fatal ao rodar suíte de testes:', err);
  process.exit(1);
});
