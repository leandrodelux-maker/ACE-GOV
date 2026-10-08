/**
 * Integração dos módulos LIRAa/LIA e Zoonoses no PostgreSQL local (homologação).
 * Recria o banco com TODAS as migrações, semeia dois municípios e exercita as RPCs e a
 * RLS simulando o PostgREST (request.jwt.claims + SET LOCAL ROLE authenticated/anon).
 *
 * Uso (com o servidor local ativo: npm run start):
 *   ../../node_modules/.bin/tsx modulos.test.ts
 */
import pg from 'pg';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { recreate, applyFile, connect, REPO } from './apply.mjs';
import { PORT } from './server.mjs';
import { planLiraaStratum, seedUnit, systematicBlockOrdinals, computeIndicators } from '../../src/services/liraa/liraaMethodology';
import { campaignIndicators } from '../../src/services/zoonoses/zoonosesMetrics';

const MUN_A = 'aaaaaaaa-0000-4000-8000-0000000000a1'; // pequeno: LIA
const MUN_B = 'bbbbbbbb-0000-4000-8000-0000000000b2'; // maior: LIRAa
const U = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const users: Record<string, { auth: string; mun: string; role: string; profile?: string; agent?: string }> = {
  coordA: { auth: U(1), mun: MUN_A, role: 'ENDEMIAS_COORDINATOR' },
  aceA: { auth: U(2), mun: MUN_A, role: 'ACE' },
  labA: { auth: U(3), mun: MUN_A, role: 'LAB_TECHNICIAN' },
  vaccA: { auth: U(4), mun: MUN_A, role: 'ZOONOSES_VACCINATOR' },
  audA: { auth: U(5), mun: MUN_A, role: 'AUDITOR_VIEWER' },
  coordB: { auth: U(6), mun: MUN_B, role: 'ENDEMIAS_COORDINATOR' },
  aceB: { auth: U(7), mun: MUN_B, role: 'ACE' },
};

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];
const check = (id: string, ok: boolean, detail = '') => {
  results.push({ id, ok, detail });
  console.log(`${ok ? '  ✅' : '  ❌'} ${id}${detail ? ` — ${detail}` : ''}`);
};

/** Executa como o usuário (transação própria, COMMIT ao final). Retorna {value} ou {error}. */
async function as<T>(c: pg.Client, who: string | 'anon', fn: (c: pg.Client) => Promise<T>, commit = true): Promise<{ value?: T; error?: string }> {
  await c.query('BEGIN');
  try {
    if (who === 'anon') {
      await c.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await c.query('SET LOCAL ROLE anon');
    } else {
      await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users[who].auth, role: 'authenticated' })]);
      await c.query('SET LOCAL ROLE authenticated');
    }
    const value = await fn(c);
    await c.query(commit ? 'COMMIT' : 'ROLLBACK');
    return { value };
  } catch (e: any) {
    await c.query('ROLLBACK').catch(() => {});
    return { error: `${e.code || ''} ${e.message}` };
  }
}
const rpc = async (c: pg.Client, fn: string, args: unknown[]) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`SELECT public.${fn}(${ph}) AS r`, args)).rows[0].r;
};
const one = async (c: pg.Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0];

async function setup(): Promise<pg.Client> {
  await recreate();
  const c = await connect();
  const files = ['shim.sql', ...readdirSync(join(REPO, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => join(REPO, 'supabase', 'migrations', f))];
  for (const f of files) {
    const r = await applyFile(c, f === 'shim.sql' ? join(REPO, 'scripts', 'homologacao', 'shim.sql') : f);
    if (!r.ok) throw new Error(`Migração falhou: ${r.file}: ${r.error}`);
  }
  console.log(`Banco recriado com ${files.length - 1} migrações.`);

  await c.query('BEGIN');
  await c.query(`INSERT INTO municipalities (id, name, ibge_code, state) VALUES ($1,'Município A','9999911','GO'),($2,'Município B','9999912','GO')`, [MUN_A, MUN_B]);
  for (const [k, u] of Object.entries(users)) {
    u.profile = (await one(c, `INSERT INTO profiles (municipality_id, full_name, email, active) VALUES ($1,$2,$3,true) RETURNING id`, [u.mun, k, `${k}@homolog.test`])).id;
    await c.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = $2`, [u.profile, u.role]);
    await c.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2)`, [u.auth, `${k}@homolog.test`]);
  }
  for (const k of ['aceA', 'aceB', 'vaccA']) {
    const u = users[k];
    u.agent = (await one(c, `INSERT INTO agents (municipality_id, profile_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id`, [u.mun, u.profile]))?.id
      ?? (await one(c, `SELECT id FROM agents WHERE profile_id = $1`, [u.profile])).id;
  }
  // Território: A com 150 imóveis em 10 quadras (1 ponto estratégico); B com 2.600 imóveis em 100 quadras
  for (const [mun, tag, perBlock, blocks] of [[MUN_A, 'A', 15, 10], [MUN_B, 'B', 26, 100]] as const) {
    const nb1 = (await one(c, `INSERT INTO neighborhoods (municipality_id, name) VALUES ($1,$2) RETURNING id`, [mun, `Centro ${tag}`])).id;
    const nb2 = (await one(c, `INSERT INTO neighborhoods (municipality_id, name) VALUES ($1,$2) RETURNING id`, [mun, `Vila ${tag}`])).id;
    const sector = (await one(c, `INSERT INTO sectors (municipality_id, neighborhood_id, name, code) VALUES ($1,$2,'Setor','S1') RETURNING id`, [mun, nb1])).id;
    await c.query(`
      WITH b AS (
        INSERT INTO blocks (municipality_id, sector_id, code) SELECT $1, $2, g::text FROM generate_series(1, $3::int) g RETURNING id, code
      )
      INSERT INTO properties (municipality_id, neighborhood_id, block_id, property_code, street, number, latitude, longitude)
      SELECT $1, CASE WHEN b.code::int % 2 = 0 THEN $5::uuid ELSE $6::uuid END, b.id, $7 || '-' || b.code || '-' || n, 'Rua ' || b.code, n::text, -16.4 + n * 0.0001, -50.9
      FROM b, generate_series(1, $4::int) n`, [mun, sector, blocks, perBlock, nb1, nb2, tag]);
  }
  const pe = await one(c, `SELECT id FROM properties WHERE municipality_id = $1 ORDER BY property_code LIMIT 1`, [MUN_A]);
  await c.query(`INSERT INTO strategic_points (municipality_id, property_id, name, category, next_inspection) VALUES ($1,$2,'Borracharia','BORRACHARIA',current_date)`, [MUN_A, pe.id]);
  const teamA = (await one(c, `INSERT INTO teams (municipality_id, name) VALUES ($1,'Equipe Vacina A') RETURNING id`, [MUN_A])).id;
  (users as any).teamA = teamA;
  await c.query('COMMIT');
  return c;
}

async function liraaTests(c: pg.Client) {
  console.log('\n🦟 LIRAa / LIA');
  // ---------- B: LIRAa (2.600 imóveis, estrato de 2.000 a 8.100 → 50%)
  const sB = await as(c, 'coordB', async (cc) => (await one(cc, `INSERT INTO liraa_surveys (municipality_id, type, name, year, cycle_number, start_date, end_date)
    VALUES ($1,'LIRAa','Teste B',2026,1,current_date,current_date + 7) RETURNING id`, [MUN_B])).id);
  const surveyB = sB.value as string;
  check('L1 Coordenador cria levantamento', !!surveyB, sB.error);
  const nbs = (await c.query(`SELECT id FROM neighborhoods WHERE municipality_id = $1`, [MUN_B])).rows.map((r) => r.id);
  const st = await as(c, 'coordB', async (cc) => (await one(cc, `INSERT INTO liraa_strata (survey_id, municipality_id, name, code, stratum_number, neighborhood_ids)
    VALUES ($1,$2,'Estrato 1','E01',1,$3) RETURNING id`, [surveyB, MUN_B, nbs])).id);
  const draw1 = await as(c, 'coordB', (cc) => rpc(cc, 'liraa_execute_draw', [surveyB, 'semente-teste']));
  check('L2 Sorteio LIRAa executado', !draw1.error, draw1.error);
  const d = await one(c, `SELECT * FROM liraa_draws WHERE survey_id = $1 AND status = 'vigente'`, [surveyB]);
  const plan = planLiraaStratum(2600, 100);
  check('L3 Parâmetros do servidor = metodologia (n, passo, Q, IA)', d.parameters.n === plan.n && d.parameters.step === plan.step && d.parameters.Q === plan.Q
    && Math.abs(d.parameters.IA - plan.IA) < 1e-9, JSON.stringify({ server: [d.parameters.n, d.parameters.step, d.parameters.Q], ts: [plan.n, plan.step, plan.Q] }));
  const unit = await seedUnit('semente-teste', st.value as string);
  const expected = systematicBlockOrdinals(unit * plan.IA, plan.IA, plan.Q, plan.A);
  const got = (await c.query(`SELECT ordinal FROM liraa_selected_blocks WHERE draw_id = $1 ORDER BY ordinal`, [d.id])).rows.map((r) => r.ordinal);
  check('L4 Quarteirões do SQL = cálculo TypeScript (mesma semente)', JSON.stringify(got) === JSON.stringify(expected), `${got.length} quarteirões`);
  const set1 = (await c.query(`SELECT property_id FROM liraa_samples WHERE draw_id = $1 ORDER BY property_id`, [d.id])).rows.map((r) => r.property_id).join();
  check('L5 Dentro do quarteirão: 1 a cada 2 (50%)', (await one(c, `SELECT count(*)::int n FROM liraa_samples WHERE draw_id = $1`, [d.id])).n === got.length * 13);
  const redo = await as(c, 'coordB', (cc) => rpc(cc, 'liraa_execute_draw', [surveyB, 'semente-teste']));
  const d2 = await one(c, `SELECT id FROM liraa_draws WHERE survey_id = $1 AND status = 'vigente'`, [surveyB]);
  const set2 = (await c.query(`SELECT property_id FROM liraa_samples WHERE draw_id = $1 ORDER BY property_id`, [d2.id])).rows.map((r) => r.property_id).join();
  const hist = (await one(c, `SELECT count(*)::int n FROM liraa_draws WHERE survey_id = $1 AND status = 'substituido'`, [surveyB])).n;
  check('L6 Sorteio reproduzível e histórico preservado', !redo.error && set1 === set2 && hist === 1, redo.error);

  // ---------- A: modalidade e LIA
  const sA = await as(c, 'coordA', async (cc) => (await one(cc, `INSERT INTO liraa_surveys (municipality_id, type, name, year, cycle_number, start_date, end_date)
    VALUES ($1,'LIRAa','Errado A',2026,1,current_date,current_date + 7) RETURNING id`, [MUN_A])).id);
  await as(c, 'coordA', (cc) => cc.query(`INSERT INTO liraa_strata (survey_id, municipality_id, name, code, stratum_number, neighborhood_ids)
    SELECT $1, $2, 'E', 'E01', 1, array_agg(id) FROM neighborhoods WHERE municipality_id = $2`, [sA.value, MUN_A]));
  const wrong = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_execute_draw', [sA.value, null]));
  check('L7 LIRAa recusado em município com menos de 2.000 imóveis', /modalidade_incompativel/.test(wrong.error || ''), wrong.error);

  const lia = await as(c, 'coordA', async (cc) => (await one(cc, `INSERT INTO liraa_surveys (municipality_id, type, name, year, cycle_number, start_date, end_date)
    VALUES ($1,'LIA','LIA A',2026,2,current_date,current_date + 7) RETURNING id`, [MUN_A])).id);
  const surveyA = lia.value as string;
  const blocked = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_execute_draw', [surveyA, null]));
  check('L8 LIA bloqueado até confirmação técnica das regras pendentes', /regras_pendentes_validacao/.test(blocked.error || ''), blocked.error);
  const shortNote = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_confirm_rules', [surveyA, 'curta']));
  const conf = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_confirm_rules', [surveyA, 'Nota Técnica SES-GO nº 00/2026 (homologação local)']));
  const aceDraw = await as(c, 'aceA', (cc) => rpc(cc, 'liraa_execute_draw', [surveyA, null]));
  check('L9 Confirmação exige justificativa; ACE não sorteia', !!shortNote.error && !conf.error && /forbidden/.test(aceDraw.error || ''), aceDraw.error);
  const liaDraw = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_execute_draw', [surveyA, 'lia']));
  const nA = (await one(c, `SELECT count(*)::int n FROM liraa_samples WHERE survey_id = $1 AND status <> 'cancelado'`, [surveyA])).n;
  const peIn = (await one(c, `SELECT count(*)::int n FROM liraa_samples s JOIN strategic_points sp ON sp.property_id = s.property_id WHERE s.survey_id = $1`, [surveyA])).n;
  check('L10 LIA (149 elegíveis, até 400: todos) sem ponto estratégico', !liaDraw.error && nA === 149 && peIn === 0, `${nA} sorteados; ${liaDraw.error || ''}`);

  // Isolamento
  const crossRead = await as(c, 'coordB', async (cc) => (await one(cc, `SELECT count(*)::int n FROM liraa_samples WHERE survey_id = $1`, [surveyA])).n);
  check('L11 Outro município não lê a amostra (RLS)', crossRead.value === 0);

  // ---------- Execução e campo
  const toExec = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'execucao', null]));
  const samples = (await c.query(`SELECT id, block_id FROM liraa_samples WHERE survey_id = $1 ORDER BY ordinal`, [surveyA])).rows;
  await as(c, 'coordA', (cc) => rpc(cc, 'liraa_assign_samples', [surveyA, samples.map((s) => s.id), users.aceA.agent]));
  const insp = (sample: string, extra: object) => ({ id: crypto.randomUUID(), sample_id: sample, inspected_at: new Date().toISOString(), ...extra });
  const p1 = insp(samples[0].id, { situation: 'trabalhado', deposits: [{ category: 'B', inspected: 2, positive: 1 }], tubes: [{ label: 'T-001', category: 'B', stage: 'larva' }] });
  const r1 = await as(c, 'aceA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(p1)]));
  const r1b = await as(c, 'aceA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(p1)]));
  const r1c = await as(c, 'aceA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify({ ...p1, id: crypto.randomUUID() })]));
  check('L12 Inspeção registrada; reenvio idempotente; segunda inspeção recusada', !toExec.error && !r1.error && (r1b.value as any)?.duplicated === true && /amostra_ja_resolvida/.test(r1c.error || ''), r1.error || r1c.error);
  const bad = await as(c, 'aceA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(insp(samples[1].id, { situation: 'trabalhado', deposits: [{ category: 'C', inspected: 3, positive: 2 }], tubes: [{ label: 'T-002', category: 'C' }] }))]));
  check('L13 Tubitos incoerentes com depósitos positivos são recusados', /tubitos_incoerentes/.test(bad.error || ''), bad.error);
  const p2 = insp(samples[1].id, { situation: 'trabalhado', deposits: [{ category: 'D2', inspected: 1, positive: 1 }], tubes: [{ label: 'T-002', category: 'D2' }] });
  await as(c, 'aceA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(p2)]));
  const crossInsp = await as(c, 'aceB', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(insp(samples[2].id, { situation: 'fechado' }))]));
  check('L14 ACE de outro município não registra inspeção', /forbidden/.test(crossInsp.error || ''), crossInsp.error);

  // Laboratório
  const aceLab = await as(c, 'aceA', async (cc) => rpc(cc, 'liraa_lab_receive', [surveyA, ['T-001']]));
  const recv = await as(c, 'labA', (cc) => rpc(cc, 'liraa_lab_receive', [surveyA, ['t-001', 'NAO-EXISTE']]));
  const tube1 = (await one(c, `SELECT id FROM entomological_samples WHERE tube_label = 'T-001'`)).id;
  const res1 = await as(c, 'labA', (cc) => rpc(cc, 'liraa_lab_result', [tube1, 'aedes_aegypti', null]));
  check('L15 Só o laboratório recebe e registra resultado', /forbidden/.test(aceLab.error || '') && (recv.value as any)?.received?.length === 1 && (recv.value as any)?.not_found?.length === 1 && !res1.error, res1.error);
  const counts = (await as(c, 'coordA', (cc) => rpc(cc, 'liraa_survey_counts', [surveyA]))).value as any;
  const mu = counts.units.find((u: any) => u.level === 'municipality');
  const ind = computeIndicators({ worked: mu.situations.trabalhado, positiveProperties: mu.positive_properties_aegypti, positiveRecipientsByType: mu.positive_recipients_aegypti || {} });
  check('L16 Positividade só com confirmação laboratorial (suspeita de campo à parte)', mu.situations.trabalhado === 2 && mu.field_positive_properties === 2
    && mu.positive_properties_aegypti === 1 && ind.iip === 50 && ind.ib === 50 && (mu.tubes_by_status.coletada || 0) === 1, JSON.stringify({ iip: ind.iip, field: mu.field_positive_properties }));

  // Encerramento e reabertura
  await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'conferencia', null]));
  const closePending = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'encerrado', null]));
  const tube2 = (await one(c, `SELECT id FROM entomological_samples WHERE tube_label = 'T-002'`)).id;
  await as(c, 'labA', (cc) => rpc(cc, 'liraa_lab_result', [tube2, 'negativo', null]));
  const close = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'encerrado', null]));
  check('L17 Encerramento exige laboratório concluído', /laboratorio_pendente/.test(closePending.error || '') && !close.error, close.error);
  const afterClose = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(insp(samples[3].id, { situation: 'fechado' }))]));
  const editClosed = await as(c, 'coordA', (cc) => cc.query(`UPDATE liraa_surveys SET name = 'alterado' WHERE id = $1`, [surveyA]));
  const labClosed = await as(c, 'labA', (cc) => rpc(cc, 'liraa_lab_result', [tube2, 'aedes_aegypti', 'retificação após encerramento']));
  check('L18 Levantamento encerrado bloqueia inspeção, edição e laboratório', /levantamento_bloqueado/.test(afterClose.error || '') && /levantamento_bloqueado/.test(editClosed.error || '') && /levantamento_bloqueado/.test(labClosed.error || ''),
    [afterClose.error, editClosed.error, labClosed.error].join(' | '));
  const reopenNo = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'conferencia', 'curta']));
  const reopen = await as(c, 'coordA', (cc) => rpc(cc, 'liraa_change_status', [surveyA, 'conferencia', 'Correção de laudo solicitada pela SES em 08/10']));
  const audit = (await one(c, `SELECT count(*)::int n FROM audit_logs WHERE module = 'liraa' AND action = 'REABRIR' AND entity_id = $1`, [surveyA])).n;
  check('L19 Reabertura formal com justificativa e auditoria', /justificativa_obrigatoria/.test(reopenNo.error || '') && !reopen.error && audit === 1, reopen.error);

  // Substituição (LIRAa em B)
  await as(c, 'coordB', (cc) => rpc(cc, 'liraa_change_status', [surveyB, 'execucao', null]));
  const sB1 = await one(c, `SELECT s.id, s.block_id, s.property_id FROM liraa_samples s WHERE s.survey_id = $1 AND s.status = 'selecionado' ORDER BY ordinal LIMIT 1`, [surveyB]);
  const free = await one(c, `SELECT p.id FROM properties p WHERE p.block_id = $1 AND NOT EXISTS (SELECT 1 FROM liraa_samples s WHERE s.survey_id = $2 AND s.property_id = p.id AND s.status <> 'cancelado') LIMIT 1`, [sB1.block_id, surveyB]);
  const other = await one(c, `SELECT p.id FROM properties p WHERE p.municipality_id = $1 AND p.block_id <> $2 LIMIT 1`, [MUN_B, sB1.block_id]);
  const subBad = await as(c, 'aceB', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(insp(sB1.id, { situation: 'fechado', substitute_property_id: other.id }))]));
  const subOk = await as(c, 'aceB', (cc) => rpc(cc, 'liraa_submit_inspection', [JSON.stringify(insp(sB1.id, { situation: 'recusa', substitute_property_id: free.id }))]));
  const subRow = await one(c, `SELECT selection_type, replacement_of FROM liraa_samples WHERE id = $1`, [(subOk.value as any)?.substitute_sample_id]);
  check('L20 Substituição só no mesmo quarteirão, registrada como substituto', /substituto_invalido/.test(subBad.error || '') && subRow?.selection_type === 'substituto' && subRow?.replacement_of === sB1.id, subOk.error);
}

async function zooTests(c: pg.Client) {
  console.log('\n🐕 Vacinação antirrábica e raiva');
  const teamA = (users as any).teamA as string;
  const prod = await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO products (municipality_id, name, category, unit, manufacturer, minimum_stock)
    VALUES ($1,'Vacina antirrábica','vacina_antirrabica','dose','Fabricante X',5) RETURNING id`, [MUN_A])).id);
  const productId = prod.value as string;
  const op = (who: string, p: object) => as(c, who, (cc) => rpc(cc, 'zoo_stock_operation', [JSON.stringify(p)]));
  const e1 = await op('vaccA', { op: 'entrada', product_id: productId, batch_number: 'L1', expiration_date: '2030-12-31', quantity: 10 });
  const e0 = await op('vaccA', { op: 'entrada', product_id: productId, batch_number: 'L0', expiration_date: '2020-01-01', quantity: 5 });
  const batchL1 = (e1.value as any)?.batch_id;
  const batchL0 = (e0.value as any)?.batch_id;
  const dist = await op('vaccA', { op: 'distribuicao', batch_id: batchL1, team_id: teamA, quantity: 5 });
  const distExpired = await op('vaccA', { op: 'distribuicao', batch_id: batchL0, team_id: teamA, quantity: 1 });
  const direct = await as(c, 'vaccA', (cc) => cc.query(`INSERT INTO stock_movements (municipality_id, product_id, batch_id, movement_type, quantity) VALUES ($1,$2,$3,'entrada',100)`, [MUN_A, productId, batchL1]));
  check('V1 Entrada e distribuição por RPC; lote vencido e movimento direto bloqueados', !e1.error && !dist.error && /lote_vencido/.test(distExpired.error || '') && !!direct.error,
    [e1.error, dist.error, direct.error].join(' | '));

  const camp = await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO vaccination_campaigns (municipality_id, name, year, start_date, end_date, target_dog_coverage_pct,
    est_dog_population, est_cat_population, population_source) VALUES ($1,'Campanha 2026',2026,current_date - 1,current_date + 10,80,10,5,'Estimativa municipal (teste)') RETURNING id`, [MUN_A])).id);
  const campaignId = camp.value as string;
  await as(c, 'vaccA', (cc) => cc.query(`UPDATE vaccination_campaigns SET status = 'em_andamento' WHERE id = $1`, [campaignId]));
  const nb = (await one(c, `SELECT id FROM neighborhoods WHERE municipality_id = $1 ORDER BY name LIMIT 1`, [MUN_A])).id;
  const post1 = (await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO vaccination_posts (municipality_id, campaign_id, name, neighborhood_id, team_id) VALUES ($1,$2,'Posto 1',$3,$4) RETURNING id`, [MUN_A, campaignId, nb, teamA])).id)).value;
  const post2 = (await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO vaccination_posts (municipality_id, campaign_id, name, neighborhood_id) VALUES ($1,$2,'Posto 2',$3) RETURNING id`, [MUN_A, campaignId, nb])).id)).value;

  const animalId = crypto.randomUUID();
  const v1 = { id: crypto.randomUUID(), record_mode: 'individual', campaign_id: campaignId, post_id: post1, batch_id: batchL1, vaccinated_at: new Date().toISOString(),
    new_animal: { id: animalId, species: 'canina', name: 'Rex', sex: 'macho', new_tutor: { id: crypto.randomUUID(), full_name: 'Tutor Teste', phone: '62999990000' } } };
  const r1 = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify(v1)]));
  const r1b = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify(v1)]));
  const dup = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify({ id: crypto.randomUUID(), record_mode: 'individual', campaign_id: campaignId, post_id: post1, batch_id: batchL1, animal_id: animalId })]));
  const teamBal = async () => Number((await one(c, `SELECT public.zoo_team_batch_balance($1,$2) b`, [teamA, batchL1])).b);
  check('V2 Dose com animal e tutor novos; reenvio idempotente; segunda dose na campanha recusada', !r1.error && /^VAC-/.test((r1.value as any)?.verification_code || '')
    && (r1b.value as any)?.duplicated === true && /animal_ja_vacinado/.test(dup.error || '') && (await teamBal()) === 4, r1.error || dup.error);

  const expired = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify({ id: crypto.randomUUID(), record_mode: 'campanha_rapida', campaign_id: campaignId, batch_id: batchL0, species: 'felina' })]));
  check('V3 Aplicação com lote vencido recusada', /lote_vencido/.test(expired.error || ''), expired.error);

  const rapid = () => as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify({ id: crypto.randomUUID(), record_mode: 'campanha_rapida', campaign_id: campaignId, post_id: post1, batch_id: batchL1, species: 'felina', sex: 'femea' })]));
  const rs: { value?: unknown; error?: string }[] = [];
  for (let i = 0; i < 5; i++) rs.push(await rapid());
  check('V4 Saldo da equipe nunca fica negativo', rs.slice(0, 4).every((r) => !r.error) && /saldo_insuficiente_equipe/.test(rs[4].error || '') && (await teamBal()) === 0, rs[4].error);

  // Concorrência: dois aparelhos aplicando a última dose central ao mesmo tempo
  const c2 = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', database: 'homolog' });
  await c2.connect();
  const central = Number((await one(c, `SELECT current_quantity q FROM product_batches WHERE id = $1`, [batchL1])).q);
  const adjNo = await op('vaccA', { op: 'ajuste', batch_id: batchL1, delta: 1 - central, reason: 'Inventário de teste de concorrência' });
  const adj = await op('coordA', { op: 'ajuste', batch_id: batchL1, delta: 1 - central, reason: 'Inventário de teste de concorrência' });
  check('V5a Ajuste de inventário só com permissão própria (vacinador não ajusta)', /forbidden/.test(adjNo.error || '') && !adj.error, adj.error);
  const race = await Promise.all([c, c2].map((cl) => as(cl, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify({
    id: crypto.randomUUID(), record_mode: 'campanha_rapida', campaign_id: campaignId, post_id: post2, batch_id: batchL1, species: 'canina' })]))));
  await c2.end();
  const left = Number((await one(c, `SELECT current_quantity q FROM product_batches WHERE id = $1`, [batchL1])).q);
  check('V5 Concorrência: só uma das duas aplicações simultâneas da última dose passa', race.filter((r) => !r.error).length === 1 && left === 0, race.map((r) => r.error || 'ok').join(' | '));

  await op('coordA', { op: 'ajuste', batch_id: batchL1, delta: 10, reason: 'Recontagem física após conferência' });
  const aggConflict = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_aggregate', [JSON.stringify({ id: crypto.randomUUID(), campaign_id: campaignId, post_id: post1,
    entry_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), species: 'canina', quantity: 3, source_document: 'B-1', batch_id: batchL1 })]));
  const post3 = (await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO vaccination_posts (municipality_id, campaign_id, name) VALUES ($1,$2,'Posto 3') RETURNING id`, [MUN_A, campaignId])).id)).value;
  const agg = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_aggregate', [JSON.stringify({ id: crypto.randomUUID(), campaign_id: campaignId, post_id: post3,
    entry_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), species: 'canina', sex: 'macho', quantity: 3, source_document: 'B-2', batch_id: batchL1 })]));
  const indAfterAgg = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_vaccination', [JSON.stringify({ id: crypto.randomUUID(), record_mode: 'campanha_rapida', campaign_id: campaignId, post_id: post3, batch_id: batchL1, species: 'canina' })]));
  check('V6 Sem dupla contagem entre registros individuais e boletim agregado', /registros_individuais_existentes/.test(aggConflict.error || '') && !agg.error && /boletim_agregado_existente/.test(indAfterAgg.error || ''), agg.error);

  const counts = (await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_vaccination_counts', [campaignId, null, null, null, null, null]))).value as any;
  const ci = campaignIndicators(counts.by_species, { est_dog_population: 10, est_cat_population: 5, target_dog_coverage_pct: 80, population_source: 'x' });
  check('V7 Consolidação: doses e animais (cães 1 individual + 1 rápido + 3 boletim = 5; gatos 4)', counts.doses_total === 9 && counts.by_species.canina.animals === 5
    && counts.by_species.felina.animals === 4 && ci.dogCoverage === 50 && ci.catCoverage === 80, JSON.stringify({ total: counts.doses_total, sp: counts.by_species }));

  const recId = (r1.value as any) ? v1.id : '';
  const voidShort = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_void_record', ['individual', recId, 'curto']));
  const balBefore = await teamBal();
  const voidOk = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_void_record', ['individual', recId, 'Registro feito no animal errado durante o atendimento']));
  const counts2 = (await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_vaccination_counts', [campaignId, null, null, null, null, null]))).value as any;
  check('V8 Anulação exige justificativa, estorna a dose e sai da contagem', !!voidShort.error && !voidOk.error && (await teamBal()) === balBefore + 1 && counts2.doses_total === 8, voidOk.error);

  const audTutors = await as(c, 'audA', async (cc) => (await one(cc, `SELECT count(*)::int n FROM animal_tutors`)).n);
  const audAnimals = await as(c, 'audA', async (cc) => (await one(cc, `SELECT count(*)::int n FROM animals`)).n);
  const crossAnimals = await as(c, 'coordB', async (cc) => (await one(cc, `SELECT count(*)::int n FROM animals`)).n);
  const vaccTutors = await as(c, 'vaccA', async (cc) => (await one(cc, `SELECT count(*)::int n FROM animal_tutors`)).n);
  check('V9 LGPD: tutores só com permissão; isolamento entre municípios', audTutors.value === 0 && (audAnimals.value as number) >= 1 && crossAnimals.value === 0 && vaccTutors.value === 1,
    JSON.stringify({ audTutors, audAnimals, crossAnimals }));

  const code = (await one(c, `SELECT verification_code FROM animal_vaccinations WHERE status = 'valida' ORDER BY synced_at LIMIT 1`)).verification_code;
  const pub = await as(c, 'anon', (cc) => rpc(cc, 'public_verify_vaccination', [code]));
  const anonRead = await as(c, 'anon', (cc) => cc.query(`SELECT * FROM animal_vaccinations LIMIT 1`));
  const keys = Object.keys((pub.value as any) || {}).sort().join(',');
  check('V10 Verificação pública sem dados pessoais; anônimo não lê registros', !pub.error && !/tutor|phone|address|name/.test(keys.replace('animal_code', '')) && !!anonRead.error, keys);

  const ev = await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO rabies_events (municipality_id, event_type, species) VALUES ($1,'agressao_animal','canina') RETURNING id, event_code`, [MUN_A])));
  const evId = (ev.value as any)?.id;
  const closeNo = await as(c, 'vaccA', (cc) => cc.query(`UPDATE rabies_events SET investigation_status = 'encerrado_confirmado' WHERE id = $1`, [evId]));
  const closeYes = await as(c, 'coordA', (cc) => cc.query(`UPDATE rabies_events SET investigation_status = 'encerrado_descartado', lab_result = 'negativo' WHERE id = $1`, [evId]));
  const hist = (await one(c, `SELECT count(*)::int n FROM rabies_event_updates WHERE event_id = $1`, [evId])).n;
  check('V11 Raiva: decisão técnica restrita; histórico automático', /^RAI-/.test((ev.value as any)?.event_code || '') && /forbidden/.test(closeNo.error || '') && !closeYes.error && hist === 2, closeNo.error);

  // Busca ativa
  const other = await as(c, 'vaccA', async (cc) => (await one(cc, `INSERT INTO animals (municipality_id, code, species, neighborhood_id) VALUES ($1,'x','canina',$2) RETURNING id`, [MUN_A, nb])).id);
  const gen = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_generate_search_tasks', [campaignId, null, users.vaccA.profile]));
  const task = await one(c, `SELECT id FROM zoo_search_tasks WHERE animal_id = $1`, [other.value]);
  const att = { id: crypto.randomUUID(), task_id: task?.id, result: 'vacinado' };
  const attNo = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_search_attempt', [JSON.stringify(att)]));
  const att2 = { ...att, result: 'nao_vacinado' };
  const attOk = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_search_attempt', [JSON.stringify(att2)]));
  const attDup = await as(c, 'vaccA', (cc) => rpc(cc, 'zoo_register_search_attempt', [JSON.stringify(att2)]));
  check('V12 Busca ativa: "vacinado" exige dose registrada; tentativa idempotente', (gen.value as number) >= 1 && /dose_nao_registrada/.test(attNo.error || '') && !attOk.error && (attDup.value as any)?.duplicated === true, gen.error || attOk.error);
}

async function compatTests(c: pg.Client) {
  console.log('\n🧩 Compatibilidade');
  const r = await as(c, 'coordA', async (cc) => {
    const p = (await one(cc, `INSERT INTO products (municipality_id, name, category, unit) VALUES ($1,'Larvicida','larvicida','g') RETURNING id`, [MUN_A])).id;
    const b = (await one(cc, `INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity_received, current_quantity) VALUES ($1,'LX','2030-01-01',10,10) RETURNING id`, [p])).id;
    await cc.query(`INSERT INTO stock_movements (municipality_id, product_id, batch_id, movement_type, quantity) VALUES ($1,$2,$3,'saida',4)`, [MUN_A, p, b]);
    const q = Number((await one(cc, `SELECT current_quantity q FROM product_batches WHERE id = $1`, [b])).q);
    let negative = '';
    try {
      await cc.query('SAVEPOINT s');
      await cc.query(`INSERT INTO stock_movements (municipality_id, product_id, batch_id, movement_type, quantity) VALUES ($1,$2,$3,'saida',99)`, [MUN_A, p, b]);
    } catch (e: any) { negative = e.message; await cc.query('ROLLBACK TO SAVEPOINT s'); }
    return { q, negative };
  });
  check('C1 Estoque existente volta a funcionar (antes falhava em toda saída) e não fica negativo', (r.value as any)?.q === 6 && /saldo_insuficiente/.test((r.value as any)?.negative || ''), r.error || JSON.stringify(r.value));
}

const c = await setup();
try {
  await liraaTests(c);
  await zooTests(c);
  await compatTests(c);
} finally {
  await c.end();
}
const failed = results.filter((r) => !r.ok);
console.log(`\nIntegração: ${results.length - failed.length}/${results.length} aprovados.`);
if (failed.length) process.exitCode = 1;
