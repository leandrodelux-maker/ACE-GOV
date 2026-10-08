/**
 * Testes dos módulos LIRAa/LIA e Vacinação Antirrábica (regras puras, fila offline,
 * permissões, relatórios e compatibilidade). As regras do banco (RPC, RLS, estoque,
 * duplicidade) são testadas em scripts/homologacao/modulos.test.ts contra PostgreSQL real.
 */
import type { UserRole } from '../types';
import {
  LIRAA_MS_2013, MethodologyError, classifyIip, computeIndicators, indicesWithinBlock, liaSelection, liaStep, planLiraaStratum,
  requiredModality, seedUnit, systematicBlockOrdinals, validateInspectionDeposits,
} from '../services/liraa/liraaMethodology';
import {
  animalCampaignStatus, batchAlert, campaignIndicators, centralBatchBalance, coverage, lowestCoverageLocalities, teamBatchBalance,
} from '../services/zoonoses/zoonosesMetrics';
import {
  MODULE_QUEUE_KEYS, QueuedRecord, enqueueRecord, isTransientError, pendingModuleCount, readModuleQueue, syncModuleQueue,
} from '../services/offlineQueue';
import { buildLiraaReport, REPORT_LABELS, splitUnits, unitIndicators, LiraaReportKind } from '../components/liraa/liraaReports';
import { buildZooReport, ZOO_REPORT_LABELS, ZooReportKind } from '../components/zoonoses/zooReports';
import { MODEL_DISCLAIMER, toCsv, toPdfBlob, toXlsxBlob } from '../services/reportExport';
import { AccessChecker, canAccessView, getHomeView, resolvePath, ROUTES } from '../config/routes';
import { PERMISSIONS_CATALOG, ROLES_REGISTRY } from '../services/rbac';
import type { QueueStorage } from '../services/offlineVisitQueue';
import type { LiraaSurvey, SurveyCounts, UnitCounts } from '../services/liraa/liraaModuleService';
import type { VaccinationCounts } from '../services/zoonoses/zoonosesService';

type Run = (suite: string, name: string, fn: () => void | Promise<void>) => Promise<void>;
type Assert = (c: boolean, m: string) => void;
type AssertEq = (a: any, b: any, m: string) => void;

const unit = (over: Partial<UnitCounts> = {}): UnitCounts => ({
  level: 'municipality', unit_id: 'm', unit_name: 'Município', programmed: 200, pending: 0, substitutes: 0,
  situations: { trabalhado: 200 }, vacant_lots: 0, field_positive_properties: 0, positive_properties_aegypti: 0, positive_properties_albopictus: 0,
  positive_recipients_aegypti: {}, positive_recipients_albopictus: 0, inspected_recipients: {}, tubes_by_status: {}, ...over,
});

const SURVEY: LiraaSurvey = {
  id: 's1', municipality_id: 'm1', type: 'LIRAa', name: 'Teste', year: 2026, cycle_number: 1, start_date: '2026-10-01', end_date: '2026-10-07',
  status: 'conferencia', total_properties: 9000, total_blocks: 350, sample_properties: 429, rule_set_id: null, coordinator_id: null,
  rules_confirmed_at: null, rules_confirmation_note: null, status_changed_at: null, cancel_reason: null, notes: null, created_at: '2026-09-20',
};

export async function runModuleTests(
  runTest: Run, assert: Assert, assertEquals: AssertEq,
  memoryStorage: () => QueueStorage & { data: Record<string, string> },
  accessFor: (role: UserRole) => AccessChecker,
) {
  console.log('\n🦟 11. LIRAa / LIA:');

  await runTest('LIRAa', 'Amostragem: n = 450/(1+450/N) e faixas de estrato do Manual LIRAa 2013', () => {
    const p = planLiraaStratum(9000, 350);
    assertEquals(p.n, 429, 'Exemplo do manual (N = 9.000): 428,6 → 429 imóveis');
    assertEquals(p.step, 5, 'Estrato de 8.100 a 12.000: 20% (1 a cada 5)');
    assert(p.Q === Math.ceil(429 / (9000 / 350 / 5)) && p.Q <= 350, `Q calculado sem arredondar B (${p.Q})`);
    assert(Math.abs(p.IA - 350 / p.Q) < 1e-12, 'IA = A/Q');
    assertEquals(planLiraaStratum(5000, 200).step, 2, 'Estrato de 2.000 a 8.100: 50% (1 a cada 2)');
    let code = '';
    try { planLiraaStratum(12001, 400); } catch (e) { code = (e as MethodologyError).code; }
    assertEquals(code, 'estrato_acima_do_limite', 'Acima de 12.000 imóveis: dividir o estrato');
    try { planLiraaStratum(1999, 80); } catch (e) { code = (e as MethodologyError).code; }
    assertEquals(code, 'estrato_abaixo_do_minimo', 'Abaixo de 2.000: caso não previsto, sinalizado para validação');
    assertEquals(LIRAA_MS_2013.base_sample, 450, 'Amostra base oficial');
  });

  await runTest('LIRAa', 'Sorteio sistemático reproduz o Quadro 1 do manual (IC 0,70; IA 4,2)', () => {
    assertEquals(systematicBlockOrdinals(0.7, 4.2, 10, 350).join(','), '1,5,9,13,18,22,26,30,34,39', 'Quarteirões sorteados');
    assertEquals(indicesWithinBlock(11, 5).join(','), '0,5,10', '"Faz um e pula quatro" a partir do 1º imóvel');
    assertEquals(indicesWithinBlock(5, 2).join(','), '0,2,4', '50%: um a cada dois');
  });

  await runTest('LIRAa', 'Sorteio reproduzível: mesma semente e escopo geram o mesmo número', async () => {
    const a = await seedUnit('semente-publica-2026', 'estrato-1');
    const b = await seedUnit('semente-publica-2026', 'estrato-1');
    const c = await seedUnit('semente-publica-2026', 'estrato-2');
    const d = await seedUnit('outra-semente', 'estrato-1');
    assertEquals(a, b, 'Reprodutível');
    assert(a !== c && a !== d, 'Escopo e semente diferentes mudam o sorteio');
    assert(a >= 0 && a < 1 && c >= 0 && c < 1, 'Intervalo [0,1)');
  });

  await runTest('LIRAa', 'LIA: modalidade pela Portaria 3.129/2016 e faixas pendentes de validação', () => {
    assertEquals(requiredModality(2500), 'LIRAa', '> 2.000 imóveis: LIRAa');
    assertEquals(requiredModality(1500), 'LIA', '< 2.000 imóveis: LIA');
    assertEquals(requiredModality(2000), 'indefinida', 'Exatamente 2.000: não definido na norma');
    assertEquals(liaStep(380), 1, 'Até 400: todos');
    assertEquals(liaStep(1000), 3, '401 a 1.500: 1 a cada 3');
    assertEquals(liaStep(1800), 5, '1.501 a 1.999: 1 a cada 5');
    let threw = false;
    try { liaStep(2000); } catch { threw = true; }
    assert(threw, 'Fora das faixas do LIA');
    assertEquals(liaSelection(10, 3, 0.5).join(','), '1,4,7', 'Início casual e passo');
  });

  await runTest('LIRAa', 'IIP, IB e ITR com valores conhecidos', () => {
    const r = computeIndicators({ worked: 200, positiveProperties: 6, positiveRecipientsByType: { A2: 4, B: 3, D2: 1 } });
    assertEquals(r.iip, 3, 'IIP = 6/200 × 100');
    assertEquals(r.ib, 4, 'IB = 8/200 × 100');
    assertEquals(r.itr.A2, 50, 'ITR A2 = 4/8');
    assertEquals(r.itr.B, 37.5, 'ITR B = 3/8');
    assertEquals(r.itr.D2, 12.5, 'ITR D2 = 1/8');
    assertEquals(r.positiveRecipients, 8, 'Recipientes positivos');
    const z = computeIndicators({ worked: 0, positiveProperties: 0, positiveRecipientsByType: {} });
    assert(z.iip === null && z.ib === null, 'Sem imóveis pesquisados: índice indisponível (não zero)');
  });

  await runTest('LIRAa', 'Classificação do IIP (Diretrizes 2009): < 1 satisfatório; até 3,9 alerta; > 3,9 risco', () => {
    assertEquals(classifyIip(0.9), 'satisfatorio', '0,9%');
    assertEquals(classifyIip(1), 'alerta', '1,0%');
    assertEquals(classifyIip(3.9), 'alerta', '3,9%');
    assertEquals(classifyIip(3.95), 'risco', '3,95% arredonda para 4,0%');
    assertEquals(classifyIip(4), 'risco', '4,0%');
    assertEquals(classifyIip(null), null, 'Sem dados');
  });

  await runTest('LIRAa', 'Resultados laboratoriais: só confirmação conta; pendência deixa índice provisório', () => {
    const u = unitIndicators(unit({ field_positive_properties: 9, positive_properties_aegypti: 4, positive_recipients_aegypti: { B: 5 }, tubes_by_status: { analisada: 5, recebida: 3, coletada: 1 } }));
    assertEquals(u.iip, 2, 'IIP usa positivos de laboratório (4), não suspeitos de campo (9)');
    assertEquals(u.fieldPositive, 9, 'Suspeita de campo exibida à parte');
    assertEquals(u.tubesPendingLab, 4, 'Tubitos sem resultado');
    assert(u.provisional, 'Índice provisório com tubitos pendentes');
    const done = unitIndicators(unit({ positive_properties_aegypti: 4, positive_recipients_aegypti: { B: 5 }, tubes_by_status: { analisada: 9 } }));
    assert(!done.provisional, 'Sem pendência: índice definitivo');
    const partial = unitIndicators(unit({ programmed: 200, situations: { trabalhado: 150, fechado: 30 } }));
    assertEquals(partial.completion, 75, 'Cumprimento da amostra (75%) separado do índice');
  });

  await runTest('LIRAa', 'Inspeção: um tubito por depósito positivo, positivos ≤ inspecionados', () => {
    assertEquals(validateInspectionDeposits([{ category: 'B', inspected: 3, positive: 2 }], [{ category: 'B' }, { category: 'B' }]).length, 0, 'Coerente');
    assert(validateInspectionDeposits([{ category: 'B', inspected: 3, positive: 2 }], [{ category: 'B' }]).length > 0, 'Faltou tubito');
    assert(validateInspectionDeposits([{ category: 'C', inspected: 1, positive: 2 }], [{ category: 'C' }, { category: 'C' }]).length > 0, 'Positivos acima do inspecionado');
  });

  console.log('\n🐕 12. VACINAÇÃO ANTIRRÁBICA:');

  await runTest('Antirrábica', 'Cobertura: animais/população; sem estimativa com fonte = indisponível', () => {
    assertEquals(coverage(80, 100), 80, '80/100');
    assertEquals(coverage(1, 3), 33.3, 'Uma casa decimal');
    assertEquals(coverage(10, null), null, 'Sem população');
    assertEquals(coverage(10, 0), null, 'População zero');
    const ind = campaignIndicators({ canina: { doses: 820, animals: 800 }, felina: { doses: 300, animals: 300 } },
      { est_dog_population: 1000, est_cat_population: null, target_dog_coverage_pct: 80, population_source: 'Estimativa SES' });
    assertEquals(ind.dogCoverage, 80, 'Cobertura canina por animais, não por doses');
    assertEquals(ind.dogTargetReached, true, 'Meta parametrizada alcançada');
    assertEquals(ind.catCoverage, null, 'Sem população felina');
    assertEquals(ind.doses, 1120, 'Doses separadas de animais');
    const semFonte = campaignIndicators({ canina: { doses: 10, animals: 10 } }, { est_dog_population: 100, population_source: '' });
    assertEquals(semFonte.dogCoverage, null, 'Estimativa sem fonte não gera cobertura');
  });

  await runTest('Antirrábica', 'Localidades com menor cobertura canina estimada', () => {
    const low = lowestCoverageLocalities([
      { neighborhood_id: 'a', name: 'A', species: 'canina', animals: 90, est_dog_population: 100 },
      { neighborhood_id: 'b', name: 'B', species: 'canina', animals: 20, est_dog_population: 100 },
      { neighborhood_id: 'c', name: 'C', species: 'canina', animals: 5, est_dog_population: null },
      { neighborhood_id: 'd', name: 'D', species: 'felina', animals: 1, est_cat_population: 100 },
    ]);
    assertEquals(low.map((l) => l.name).join(','), 'B,A', 'Ordena pela menor cobertura e ignora sem estimativa');
  });

  await runTest('Antirrábica', 'Busca ativa: não vacinado confirmado ≠ sem informação', () => {
    assertEquals(animalCampaignStatus(true, []), 'vacinado', 'Dose registrada');
    assertEquals(animalCampaignStatus(false, ['nao_vacinado']), 'nao_vacinado_confirmado', 'Confirmado em visita');
    assertEquals(animalCampaignStatus(false, ['ausente', 'animal_nao_encontrado']), 'sem_informacao', 'Ausência não é "não vacinado"');
  });

  await runTest('Antirrábica', 'Estoque por lote: saldo de equipe, saldo central e alertas', () => {
    const mv = [
      { movement_type: 'entrada', quantity: 100, team_id: null },
      { movement_type: 'distribuicao_equipe', quantity: 40, team_id: 't1' },
      { movement_type: 'aplicacao_equipe', quantity: 25, team_id: 't1' },
      { movement_type: 'perda_equipe', quantity: 2, team_id: 't1' },
      { movement_type: 'devolucao', quantity: 5, team_id: 't1' },
      { movement_type: 'estorno_equipe', quantity: 1, team_id: 't1' },
      { movement_type: 'uso_operacao', quantity: 3, team_id: null },
      { movement_type: 'estorno_aplicacao', quantity: 1, team_id: null },
    ];
    assertEquals(teamBatchBalance(mv, 't1'), 9, 'Equipe: 40 − 25 − 2 − 5 + 1');
    assertEquals(centralBatchBalance(mv), 63, 'Central: 100 − 40 + 5 − 3 + 1');
    assertEquals(batchAlert({ expiration_date: '2026-10-01', central_balance: 10 }, '2026-10-08'), 'vencido', 'Lote vencido com saldo');
    assertEquals(batchAlert({ expiration_date: '2026-10-20', central_balance: 10 }, '2026-10-08'), 'vence_em_30_dias', 'Vence em até 30 dias');
    assertEquals(batchAlert({ expiration_date: '2027-10-20', central_balance: 3, minimum_stock: 10 }, '2026-10-08'), 'saldo_baixo', 'Abaixo do mínimo');
    assertEquals(batchAlert({ expiration_date: '2027-10-20', central_balance: 30, minimum_stock: 10 }, '2026-10-08'), null, 'Sem alerta');
  });

  console.log('\n📴 13. FILA OFFLINE DOS MÓDULOS:');

  await runTest('Offline', 'Sem duplicidade, sem perda durante o envio e sem envio por outro usuário', async () => {
    const st = memoryStorage();
    const rec = (id: string, profile = 'p1'): Omit<QueuedRecord, 'status' | 'retryCount' | 'created_at'> =>
      ({ id, kind: 'vaccination', municipality_id: 'm1', profile_id: profile, payload: { id }, label: id });
    enqueueRecord(rec('a'), st);
    enqueueRecord(rec('a'), st);
    enqueueRecord(rec('b'), st);
    enqueueRecord(rec('c', 'outro'), st);
    assertEquals(readModuleQueue('vaccination', st).length, 3, 'Mesmo id não duplica');
    const sent: string[] = [];
    const res = await syncModuleQueue('vaccination', async (r) => {
      sent.push(r.id);
      if (r.id === 'a') enqueueRecord(rec('d'), st); // registrado durante o envio
      if (r.id === 'b') return { success: false, message: 'animal_ja_vacinado' };
      return { success: true };
    }, { municipalityId: 'm1', profileId: 'p1' }, st);
    assertEquals(sent.join(','), 'a,b', 'Item de outro usuário não é enviado nesta sessão');
    const left = readModuleQueue('vaccination', st).map((r) => `${r.id}:${r.status}`).sort().join(',');
    assertEquals(left, 'b:erro,c:pendente,d:pendente', 'Enviado sai; erro de validação fica para correção; novos e de outro usuário permanecem');
    assertEquals(res.synced, 1, 'Um sincronizado');
    assert(isTransientError('Failed to fetch') && !isTransientError('animal_ja_vacinado'), 'Erro de rede é reenviado automaticamente; validação não');
    assert(pendingModuleCount(st) === 3, 'Contador do cabeçalho inclui as filas dos módulos');
    assert(Object.values(MODULE_QUEUE_KEYS).every((k) => k.startsWith('endemias_queue_')), 'Chaves preservadas no logout');
  });

  await runTest('Offline', 'Logout preserva filas de registros pendentes (visitas, inspeções, vacinações)', async () => {
    const mem: Record<string, string> = {
      endemias_sync_queue: '[1]', endemias_queue_liraa_v1: '[2]', endemias_queue_liraa_tubeseq_v1: '{}', endemias_cache_liraa_campo_v1: 'x',
      endemias_gov_bootstrap_v2_u: 'y', endemias_rascunho_v1_liraa_s: 'z', outra_chave: 'w',
    };
    const fake = {
      get length() { return Object.keys(mem).length; },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: (k: string) => { delete mem[k]; },
      clear: () => {},
    };
    const g = globalThis as any;
    const prevLocal = g.localStorage;
    const prevSession = g.sessionStorage;
    g.localStorage = fake;
    g.sessionStorage = { length: 0, key: () => null, removeItem: () => {} };
    try {
      const { clearLocalCaches } = await import('../services/authService');
      clearLocalCaches();
    } finally {
      g.localStorage = prevLocal;
      g.sessionStorage = prevSession;
    }
    assertEquals(Object.keys(mem).sort().join(','), 'endemias_queue_liraa_tubeseq_v1,endemias_queue_liraa_v1,endemias_sync_queue,outra_chave',
      'Filas e numeração de tubitos ficam; caches, sessão e rascunhos são apagados');
  });

  console.log('\n🔐 14. PERMISSÕES, ROTAS E RELATÓRIOS DOS MÓDULOS:');

  await runTest('Permissões', 'Rotas novas exigem permissão do módulo; perfis recebem acesso adequado', () => {
    for (const r of ROUTES.filter((x) => x.view.startsWith('liraa') || x.view.startsWith('zoo_'))) {
      assert(!!r.permission && /^(liraa|antirrabica|raiva)\./.test(r.permission), `${r.path} usa permissão do módulo`);
    }
    const slugs = new Set(PERMISSIONS_CATALOG.map((p) => p.slug));
    for (const r of ROUTES) if (r.permission && /^(liraa|antirrabica|raiva)\./.test(r.permission)) assert(slugs.has(r.permission), `${r.permission} no catálogo`);
    const ace = accessFor('ACE');
    assert(canAccessView('liraa_field', ace) && canAccessView('zoo_vaccination', ace), 'ACE coleta LIRAa e vacina');
    assert(!canAccessView('liraa_lab', ace), 'ACE não acessa o laboratório');
    const lab = accessFor('LAB_TECHNICIAN');
    assertEquals(getHomeView('LAB_TECHNICIAN', lab), 'liraa_lab', 'Tela inicial do laboratório');
    assert(!canAccessView('zoo_vaccination', lab), 'Laboratório não registra vacinação');
    const aud = accessFor('AUDITOR_VIEWER');
    assert(canAccessView('zoo_dashboard', aud) && !canAccessView('zoo_vaccination', aud), 'Consulta vê painel, não registra');
    assert(!ROLES_REGISTRY.ACE.defaultPermissions.includes('antirrabica.estoque_ajuste'), 'Ajuste de estoque não é do ACE');
    assert(ROLES_REGISTRY.STOCK_MANAGER.defaultPermissions.includes('antirrabica.estoque_ajuste'), 'Gestor de estoque ajusta inventário');
    assert(!ROLES_REGISTRY.FIELD_SUPERVISOR.defaultPermissions.includes('raiva.decidir'), 'Decisão técnica da raiva restrita');
    assertEquals(resolvePath('/verificar-vacina').kind, 'public', 'Verificação da carteira é pública');
  });

  await runTest('Relatórios', 'Todos os relatórios LIRAa/LIA e antirrábicos são gerados (CSV, Excel e PDF)', async () => {
    const counts: SurveyCounts = {
      survey_id: 's1', status: 'conferencia',
      units: [unit({ positive_properties_aegypti: 4, positive_recipients_aegypti: { B: 5 }, tubes_by_status: { analisada: 5 } }),
        unit({ level: 'stratum', unit_id: 'e1', unit_name: 'Estrato 1' }), unit({ level: 'neighborhood', unit_id: 'n1', unit_name: 'Centro' })],
      agents: [{ agent_id: 'a', name: 'Agente', inspections: 22, worked: 20, closed: 1, refused: 1, days: 1, first_at: null, last_at: null }],
    };
    for (const kind of Object.keys(REPORT_LABELS) as LiraaReportKind[]) {
      const doc = buildLiraaReport(kind, { survey: SURVEY, municipalityLabel: 'Moiporá/GO', counts, strata: [], draws: [], samples: [], blocks: [], inspections: [], tubes: [],
        history: [{ survey: SURVEY, municipality: splitUnits(counts).municipality }] });
      assert(doc.tables.length > 0 && doc.tables.every((t) => t.columns.length > 0), `${kind}: tabelas`);
    }
    const vc: VaccinationCounts = {
      campaign: null, doses_total: 3, doses_by_source: { individual: 2, agregado: 1 }, by_species: { canina: { doses: 3, animals: 3 } },
      by_sex: [{ species: 'canina', sex: 'macho', doses: 3 }], by_age_group: [], by_day: [{ day: '2026-10-08', species: 'canina', doses: 3 }],
      by_neighborhood: [{ neighborhood_id: 'n1', name: 'Centro', species: 'canina', doses: 3, animals: 3, est_dog_population: 10, est_cat_population: null }],
      by_team: [], by_post: [], localities: [{ neighborhood_id: 'n1', name: 'Centro', est_dog_population: 10, est_cat_population: null }],
    };
    for (const kind of Object.keys(ZOO_REPORT_LABELS) as ZooReportKind[]) {
      const doc = buildZooReport(kind, { counts: vc, campaign: null, municipalityLabel: 'Moiporá/GO', balances: [] });
      assert(doc.tables.length > 0, `${kind}: tabelas`);
    }
    const doc = buildLiraaReport('indicadores', { survey: SURVEY, municipalityLabel: 'Moiporá/GO', counts });
    const csv = toCsv(doc);
    assert(csv.startsWith('\uFEFF') && csv.includes('IIP (%)') && csv.includes(MODEL_DISCLAIMER), 'CSV com BOM, colunas e ressalva de modelo');
    const xlsx = await toXlsxBlob(doc);
    assert(xlsx.size > 1000, `Excel gerado (${xlsx.size} bytes)`);
    const pdf = await toPdfBlob(doc);
    const head = new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer()));
    assert(head === '%PDF-' && pdf.size > 1000, `PDF gerado (${pdf.size} bytes)`);
  });
}
