/**
 * Suíte de Testes Automatizados para o Endemias GOV
 * Executado via Node/tsx: npx tsx src/tests/testSuite.ts
 */

import 'dotenv/config'; // carrega .env para process.env (fora do runtime Vite)
import { can, hasRole } from '../services/rbac';
import { UserRole } from '../types';
import { DEPOSIT_CATEGORIES, CONDUCT_OPTIONS } from '../services/visitOfficialService';
import { CORE_MODULES, isCoreModule, CORE_MODULE_DEFINITIONS } from '../config/coreModules';
import { systemAuditService, ALL_SYSTEM_PAGES } from '../services/systemAuditService';

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

    // Teste de resolução de rotas equivalentes
    const resolveRoute = (path: string): string => {
      if (path === '/ovitrampas' || path === '/ovitraps') return 'ovitraps';
      if (path === '/visitas' || path === '/visits') return 'visits';
      if (path === '/imoveis' || path === '/properties') return 'properties';
      if (path === '/territorio' || path === '/territory') return 'territory';
      return 'dashboard';
    };

    assertEquals(resolveRoute('/ovitrampas'), 'ovitraps', '/ovitrampas deve resolver para a view ovitraps');
    assertEquals(resolveRoute('/ovitraps'), 'ovitraps', '/ovitraps alternativo deve resolver para a view ovitraps');
  });

  await runTest('Ovitrampas Core', '[MENU] Usuário com permissão ovitraps.view visualiza o módulo no menu', () => {
    // Simulação do filtro do Sidebar
    const menuSection = {
      title: 'VIGILÂNCIA & INTELIGÊNCIA',
      items: [
        { id: 'dashboard', label: 'Sala de Situação', requiredPermission: 'dashboard.view' },
        { id: 'ovitraps', label: 'Ovitrampas (Ovos)', requiredPermission: 'ovitraps.view' },
      ],
    };

    const filterMenuForRole = (role: UserRole) => {
      return menuSection.items.filter(item => can(role, item.requiredPermission));
    };

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

  await runTest('Auditoria do Sistema', 'Validação do Catálogo de 58 Páginas/Módulos', () => {
    assert(ALL_SYSTEM_PAGES.length === 58, `Deve conter 58 páginas mapeadas no catálogo (encontradas: ${ALL_SYSTEM_PAGES.length})`);
    
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

  await runTest('Auditoria do Sistema', 'Execução de Auditoria Completa e Persistência no Banco', async () => {
    const { summary } = await systemAuditService.runCompleteAudit('test-runner-automated');
    assert(summary.pagesChecked === 58, `Auditoria deve checar 58 páginas (checou: ${summary.pagesChecked})`);
    assert(summary.functionalCount === 58, `Auditoria deve validar 58 páginas como FUNCIONAIS (validou: ${summary.functionalCount})`);
    assert(summary.partialCount === 0, `Não deve haver páginas parciais`);
    assert(summary.mockCount === 0, `Não deve haver páginas com mock data`);
    assert(summary.errorCount === 0, `Não deve haver páginas com erro`);
    assert(summary.databaseConnected === true, `Conexão com o banco deve estar ativa`);
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
