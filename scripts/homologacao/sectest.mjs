// Testes de segurança (RLS/RPC) e regressão no banco de homologação local.
// Uso: node sectest.mjs --label=antes|depois [--seed]
// Cada teste roda numa transação com ROLLBACK, simulando o PostgREST:
//   set_config('request.jwt.claims', ...) + SET LOCAL ROLE authenticated|anon
import { connect } from './apply.mjs';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const label = args.label || 'execucao';

export const MUN_A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const MUN_B = 'bbbbbbbb-0000-4000-8000-000000000002';

const U = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const users = {
  aceA:   { auth: U(1), email: 'ace.a@homolog.test',    mun: MUN_A, role: 'ACE',                  name: 'ACE A' },
  ace2A:  { auth: U(2), email: 'ace2.a@homolog.test',   mun: MUN_A, role: 'ACE',                  name: 'ACE A2' },
  supA:   { auth: U(3), email: 'sup.a@homolog.test',    mun: MUN_A, role: 'FIELD_SUPERVISOR',     name: 'Supervisor A' },
  coordA: { auth: U(4), email: 'coord.a@homolog.test',  mun: MUN_A, role: 'ENDEMIAS_COORDINATOR', name: 'Coordenador A' },
  adminA: { auth: U(5), email: 'admin.a@homolog.test',  mun: MUN_A, role: 'MUNICIPAL_ADMIN',      name: 'Admin A' },
  adminB: { auth: U(6), email: 'admin.b@homolog.test',  mun: MUN_B, role: 'MUNICIPAL_ADMIN',      name: 'Admin B' },
  aceB:   { auth: U(7), email: 'ace.b@homolog.test',    mun: MUN_B, role: 'ACE',                  name: 'ACE B' },
  root:   { auth: U(8), email: 'root@homolog.test',     mun: MUN_A, role: 'SUPER_ADMIN',          name: 'Plataforma' },
  // Cadastro público (sign-up) sem perfil pré-provisionado
  stranger: { auth: U(9), email: 'estranho@externo.test', mun: null, role: null, name: 'Estranho' },
};

const one = async (c, sql, params) => (await c.query(sql, params)).rows[0];

export async function seed(c) {
  await c.query('BEGIN');
  await c.query(`INSERT INTO municipalities (id, name, ibge_code, state) VALUES
    ($1, 'Município A (homologação)', '9999901', 'RS'), ($2, 'Município B (homologação)', '9999902', 'SC')`, [MUN_A, MUN_B]);
  // Perfis pré-provisionados pela gestão (sem login ainda)
  for (const [k, u] of Object.entries(users)) {
    if (!u.mun) continue;
    const p = await one(c, `INSERT INTO profiles (municipality_id, full_name, email, active) VALUES ($1,$2,$3,true) RETURNING id`, [u.mun, u.name, u.email]);
    u.profile = p.id;
    await c.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = $2`, [p.id, u.role]);
  }
  // Criação das contas no Auth: o gatilho on_auth_user_created vincula por e-mail
  for (const u of Object.values(users)) {
    await c.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [u.auth, u.email, JSON.stringify({ full_name: u.name })]);
  }
  users.stranger.profile = (await one(c, `SELECT id FROM profiles WHERE auth_user_id = $1`, [users.stranger.auth]))?.id;

  for (const [mun, tag] of [[MUN_A, 'A'], [MUN_B, 'B']]) {
    const nb = await one(c, `INSERT INTO neighborhoods (municipality_id, name) VALUES ($1, $2) RETURNING id`, [mun, `Centro ${tag}`]);
    for (let i = 1; i <= 2; i++) {
      await c.query(`INSERT INTO properties (municipality_id, neighborhood_id, property_code, street, number) VALUES ($1,$2,$3,$4,$5)`,
        [mun, nb.id, `IMV-${tag}-${i}`, `Rua ${tag}`, String(i)]);
    }
    await c.query(`INSERT INTO field_cycles (municipality_id, name, cycle_number, year, start_date, end_date) VALUES ($1,$2,1,2026,'2026-01-01','2026-12-31')`, [mun, `Ciclo ${tag}`]);
    await c.query(`INSERT INTO complaints (municipality_id, protocol, description, street, complainant_name, complainant_phone) VALUES ($1,$2,'Foco de água parada no quintal','Rua ${tag}','Cidadão ${tag}','(00) 0000-000${tag === 'A' ? 1 : 2}')`, [mun, `END-TESTE-${tag}`]);
    await c.query(`INSERT INTO system_settings (municipality_id, setting_key, setting_value) VALUES ($1, 'GERAL', '{"nome":"${tag}"}')`, [mun]);
    await c.query(`INSERT INTO system_error_logs (municipality_id, request_id, page, action, error_message) VALUES ($1,'req-${tag}','/','teste','erro de teste ${tag}')`, [mun]);
  }
  for (const k of ['aceA', 'supA', 'aceB']) {
    const u = users[k];
    u.agent = (await one(c, `INSERT INTO agents (municipality_id, profile_id) VALUES ($1,$2) RETURNING id`, [u.mun, u.profile])).id;
  }
  await c.query('COMMIT');
}

export async function loadIds(c) {
  for (const u of Object.values(users)) {
    const p = await one(c, `SELECT id FROM profiles WHERE auth_user_id = $1`, [u.auth]);
    u.profile = p?.id;
    u.agent = (await one(c, `SELECT id FROM agents WHERE profile_id = $1`, [u.profile ?? null]))?.id;
  }
}

// IDs lidos como superusuário ANTES de assumir o papel do teste (a RLS esconderia os de outro município)
const idCache = {};
async function loadRefIds(c) {
  for (const mun of [MUN_A, MUN_B]) {
    idCache[mun] = {
      property: (await one(c, `SELECT id FROM properties WHERE municipality_id = $1 ORDER BY property_code LIMIT 1`, [mun])).id,
      cycle: (await one(c, `SELECT id FROM field_cycles WHERE municipality_id = $1 LIMIT 1`, [mun])).id,
    };
  }
}
const ids = async (_c, mun) => idCache[mun];

/** Executa fn como o usuário informado (ou anon) e sempre desfaz. */
export async function as(c, who, fn) {
  await c.query('BEGIN');
  try {
    if (who === 'anon') {
      await c.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await c.query('SET LOCAL ROLE anon');
    } else {
      const u = users[who];
      await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.auth, role: 'authenticated', email: u.email })]);
      await c.query('SET LOCAL ROLE authenticated');
    }
    return { ok: true, value: await fn(c) };
  } catch (e) {
    return { ok: false, error: `${e.code || ''} ${e.message}`.trim() };
  } finally {
    await c.query('ROLLBACK');
  }
}

const count = async (c, sql, params) => Number((await c.query(sql, params)).rows[0].n);
const rows = async (c, sql, params) => (await c.query(sql, params)).rowCount;
const tableExists = async (c, t) => !!(await one(c, `SELECT to_regclass($1) AS t`, [`public.${t}`])).t;

// kind: 'exploit' (seguro = exploit falha) | 'regressao' (deve funcionar) | 'bug' (funcionalidade)
export const tests = [
  // ---------------- S1: MUNICIPAL_ADMIN tratado como administrador da plataforma
  { id: 'S1a', kind: 'exploit', who: 'adminA', title: 'Admin municipal de A lê imóveis do município B',
    run: (c) => count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S1b', kind: 'exploit', who: 'adminA', title: 'Admin municipal de A altera imóvel do município B',
    run: (c) => rows(c, `UPDATE properties SET street = 'alterado' WHERE municipality_id = $1`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S1c', kind: 'exploit', who: 'adminA', title: 'Admin municipal de A lê nome/telefone de denunciantes de B',
    run: (c) => count(c, `SELECT count(*) n FROM complaints WHERE municipality_id = $1 AND complainant_name IS NOT NULL`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S1d', kind: 'exploit', who: 'adminA', title: 'Admin municipal de A lista outros municípios',
    run: (c) => count(c, `SELECT count(*) n FROM municipalities WHERE id <> $1`, [MUN_A]), vulnerable: (r) => r.ok && r.value > 0 },

  // ---------------- S2: atribuição de papéis
  { id: 'S2a', kind: 'exploit', who: 'coordA', title: 'Coordenador se promove a MUNICIPAL_ADMIN',
    run: (c) => rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'MUNICIPAL_ADMIN'`, [users.coordA.profile]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S2b', kind: 'exploit', who: 'adminA', title: 'Admin de A atribui papel a usuário do município B',
    run: (c) => rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'AUDITOR_VIEWER'`, [users.aceB.profile]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S2c', kind: 'exploit', who: 'adminA', title: 'Admin de A se atribui SUPER_ADMIN',
    run: (c) => rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'SUPER_ADMIN'`, [users.adminA.profile]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S2d', kind: 'exploit', who: 'adminA', title: 'Admin de A remove o papel do admin de B',
    run: (c) => rows(c, `DELETE FROM user_roles WHERE user_id = $1`, [users.adminB.profile]), vulnerable: (r) => r.ok && r.value > 0 },

  // ---------------- S3: RPC de visita confia no município enviado pelo navegador
  { id: 'S3a', kind: 'exploit', who: 'aceA', title: 'ACE de A grava visita no município B via RPC',
    run: async (c) => { const b = await ids(c, MUN_B);
      const r = await one(c, `SELECT submit_official_visit($1::jsonb) AS r`, [JSON.stringify({ municipality_id: MUN_B, property_id: b.property, cycle_id: b.cycle, agent_id: users.aceB.agent })]);
      return r.r; }, vulnerable: (r) => r.ok && r.value?.success === true },
  { id: 'S3b', kind: 'exploit', who: 'aceA', title: 'ACE de A grava visita apontando imóvel de B (sem informar município)',
    run: async (c) => { const b = await ids(c, MUN_B); const a = await ids(c, MUN_A);
      const r = await one(c, `SELECT submit_official_visit($1::jsonb) AS r`, [JSON.stringify({ property_id: b.property, cycle_id: a.cycle, agent_id: users.aceA.agent })]);
      return r.r; }, vulnerable: (r) => r.ok && r.value?.success === true },

  // ---------------- S4: catálogo global de papéis editável por quem tem perfis.manage
  { id: 'S4a', kind: 'exploit', who: 'coordA', title: 'Coordenador renomeia papéis e vira SUPER_ADMIN (lê B)',
    run: async (c) => {
      const r1 = await rows(c, `UPDATE roles SET slug = 'X_TMP' WHERE slug = 'SUPER_ADMIN'`);
      const r2 = await rows(c, `UPDATE roles SET slug = 'SUPER_ADMIN' WHERE slug = 'ENDEMIAS_COORDINATOR'`);
      const leak = await count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_B]);
      return { r1, r2, leak }; }, vulnerable: (r) => r.ok && r.value.r2 > 0 },
  { id: 'S4b', kind: 'exploit', who: 'adminA', title: 'Admin de A apaga o papel global ACE (todos os municípios)',
    run: (c) => rows(c, `DELETE FROM roles WHERE slug = 'ACE'`), vulnerable: (r) => r.ok && r.value > 0 },

  // ---------------- S5: autoedição do perfil troca município / ativa conta
  { id: 'S5a', kind: 'exploit', who: 'aceA', title: 'ACE de A muda o próprio município para B e lê dados de B',
    run: async (c) => {
      const n = await rows(c, `UPDATE profiles SET municipality_id = $1 WHERE auth_user_id = auth.uid()`, [MUN_B]);
      return { n, leak: await count(c, `SELECT count(*) n FROM complaints WHERE municipality_id = $1`, [MUN_B]) }; },
    vulnerable: (r) => r.ok && r.value.n > 0 && r.value.leak > 0 },
  { id: 'S5b', kind: 'exploit', who: 'stranger', title: 'Cadastro público se autoativa em B e lê denúncias com dados pessoais',
    run: async (c) => {
      const n = await rows(c, `UPDATE profiles SET active = true, municipality_id = $1 WHERE auth_user_id = auth.uid()`, [MUN_B]);
      return { n, leak: await count(c, `SELECT count(*) n FROM complaints WHERE complainant_name IS NOT NULL`) }; },
    vulnerable: (r) => r.ok && r.value.n > 0 && r.value.leak > 0 },

  { id: 'S5c', kind: 'exploit', who: 'adminA', title: 'Admin de A move o próprio perfil para B e lê denúncias de B',
    run: async (c) => {
      const n = await rows(c, `UPDATE profiles SET municipality_id = $1 WHERE auth_user_id = auth.uid()`, [MUN_B]);
      return { n, leak: await count(c, `SELECT count(*) n FROM complaints WHERE municipality_id = $1`, [MUN_B]) }; },
    vulnerable: (r) => r.ok && r.value.n > 0 },
  { id: 'A1', kind: 'exploit', who: 'aceA', title: 'ACE (sem agentes.manage) cria cadastro de agente',
    run: (c) => rows(c, `INSERT INTO agents (municipality_id, profile_id) VALUES ($1, $2)`, [MUN_A, users.ace2A.profile]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'B1', kind: 'regressao', who: 'root', title: 'Todo perfil ACE ativo tem cadastro de agente (backfill)',
    run: async (c) => { await c.query('RESET ROLE'); return count(c, `SELECT count(*) n FROM profiles p JOIN user_roles ur ON ur.user_id = p.id JOIN roles r ON r.id = ur.role_id AND r.slug = 'ACE' WHERE p.active AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.profile_id = p.id)`); },
    works: (r) => r.ok && r.value === 0 },
  { id: 'D1', kind: 'regressao', who: 'root', title: 'Tabelas descontinuadas: leitura mantida, escrita bloqueada',
    run: async (c) => { await c.query('RESET ROLE'); return one(c, `SELECT has_table_privilege('authenticated','public.trainings','SELECT') AS ler, has_table_privilege('authenticated','public.trainings','INSERT') AS gravar`); },
    works: (r) => r.ok && r.value.ler === true && r.value.gravar === false },

  // ---------------- S6/S7: configurações e logs de erro sem filtro de município
  { id: 'S6', kind: 'exploit', who: 'adminA', title: 'Admin de A altera configurações do município B',
    run: (c) => rows(c, `UPDATE system_settings SET setting_value = '{"alterado":true}' WHERE municipality_id = $1`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S7a', kind: 'exploit', who: 'adminA', title: 'Admin de A lê logs de erro do município B',
    run: (c) => count(c, `SELECT count(*) n FROM system_error_logs WHERE municipality_id = $1`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'S7b', kind: 'exploit', who: 'adminA', title: 'Admin de A apaga logs de erro do município B',
    run: (c) => rows(c, `DELETE FROM system_error_logs WHERE municipality_id = $1`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },

  // ---------------- S8: matriz global de permissões alterada por admin municipal
  { id: 'S8a', kind: 'exploit', who: 'coordA', title: 'Coordenador altera permissões do papel ACE (vale para todos os municípios)',
    run: (c) => c.query(`SELECT set_role_permissions('ACE', ARRAY['visitas.view'])`).then(() => 'alterado'), vulnerable: (r) => r.ok },
  { id: 'S8b', kind: 'exploit', who: 'adminA', title: 'Admin de A altera permissões do papel ACE (vale para todos os municípios)',
    run: (c) => c.query(`SELECT set_role_permissions('ACE', ARRAY['visitas.view'])`).then(() => 'alterado'), vulnerable: (r) => r.ok },

  // ---------------- S9: autoria forjada na trilha de auditoria
  { id: 'S9', kind: 'exploit', who: 'aceA', title: 'ACE registra auditoria em nome do admin',
    run: async (c) => {
      await c.query(`INSERT INTO audit_logs (municipality_id, user_id, action, module, entity) VALUES ($1, $2, 'FORJADO', 'teste', 'teste')`, [MUN_A, users.adminA.profile]);
      await c.query('RESET ROLE');
      return (await one(c, `SELECT user_id FROM audit_logs WHERE action = 'FORJADO'`)).user_id; },
    vulnerable: (r) => r.ok && r.value === users.adminA.profile },

  // ---------------- Portal do cidadão
  { id: 'P1', kind: 'bug', who: 'anon', title: 'Cidadão registra denúncia pelo portal (RPC pública)',
    run: async (c) => (await one(c, `SELECT public_submit_complaint($1::jsonb) AS r`, [JSON.stringify({ municipalityId: MUN_A, problemType: 'foco_larvas', description: 'Pneus com água parada no terreno', isAnonymous: true })])).r,
    works: (r) => r.ok && /^END-\d{4}-\d{6}$/.test(r.value?.protocol || '') && (r.value?.trackingToken || '').length === 12 },
  { id: 'P2', kind: 'regressao', who: 'anon', title: 'Anônimo não lê tabela de denúncias diretamente',
    run: (c) => count(c, `SELECT count(*) n FROM complaints`), works: (r) => !r.ok && /permission denied/.test(r.error) },
  { id: 'P3', kind: 'regressao', who: 'anon', title: 'Portal: consulta pública de protocolo (sem dados pessoais)',
    run: async (c) => { await c.query(`RESET ROLE`); await c.query(`UPDATE complaints SET tracking_token = 'ABCDEF123456' WHERE protocol = 'END-TESTE-A'`); await c.query('SET LOCAL ROLE anon');
      return (await one(c, `SELECT public_track_complaint('END-TESTE-A', 'abcdef123456') AS r`)).r; },
    works: (r) => r.ok && !!r.value?.status && !JSON.stringify(r.value).includes('Cidadão') },

  // ---------------- Regressões: fluxos legítimos que precisam continuar funcionando
  { id: 'R1', kind: 'regressao', who: 'aceA', title: 'ACE lê imóveis do próprio município',
    run: (c) => count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_A]), works: (r) => r.ok && r.value === 2 },
  { id: 'R2', kind: 'regressao', who: 'aceA', title: 'ACE grava visita no próprio município via RPC (e reenvio é idempotente)',
    run: async (c) => { const a = await ids(c, MUN_A);
      const p = JSON.stringify({ id: 'cccccccc-0000-4000-8000-000000000001', municipality_id: MUN_A, property_id: a.property, cycle_id: a.cycle, agent_id: users.aceA.agent, result: 'trabalhado' });
      const r1 = (await one(c, `SELECT submit_official_visit($1::jsonb) AS r`, [p])).r;
      const r2 = (await one(c, `SELECT submit_official_visit($1::jsonb) AS r`, [p])).r;
      return { first: r1.success === true && !r1.duplicated, second: r2.duplicated === true }; },
    works: (r) => r.ok && r.value.first && r.value.second },
  { id: 'R3', kind: 'regressao', who: 'adminA', title: 'Admin de A atribui papel a usuário do próprio município',
    run: (c) => rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'AUDITOR_VIEWER'`, [users.ace2A.profile]), works: (r) => r.ok && r.value === 1 },
  { id: 'R4', kind: 'regressao', who: 'adminA', title: 'Admin de A promove usuário do próprio município a MUNICIPAL_ADMIN',
    run: (c) => rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'MUNICIPAL_ADMIN'`, [users.ace2A.profile]), works: (r) => r.ok && r.value === 1 },
  { id: 'R5', kind: 'regressao', who: 'coordA', title: 'Coordenador troca papel de ACE do próprio município (setRole: apaga e insere)',
    run: async (c) => { const d = await rows(c, `DELETE FROM user_roles WHERE user_id = $1`, [users.ace2A.profile]);
      const i = await rows(c, `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE slug = 'FIELD_SUPERVISOR'`, [users.ace2A.profile]); return { d, i }; },
    works: (r) => r.ok && r.value.d === 1 && r.value.i === 1 },
  { id: 'R6', kind: 'regressao', who: 'adminA', title: 'Admin de A desativa usuário do próprio município',
    run: (c) => rows(c, `UPDATE profiles SET active = false WHERE id = $1 AND municipality_id = $2`, [users.ace2A.profile, MUN_A]), works: (r) => r.ok && r.value === 1 },
  { id: 'R7', kind: 'regressao', who: 'adminA', title: 'Admin de A edita dados cadastrais de usuário do próprio município',
    run: (c) => rows(c, `UPDATE profiles SET full_name = 'ACE A2 (editado)', job_title = 'Agente' WHERE id = $1 AND municipality_id = $2`, [users.ace2A.profile, MUN_A]), works: (r) => r.ok && r.value === 1 },
  { id: 'R8', kind: 'regressao', who: 'aceA', title: 'ACE edita o próprio telefone e nome',
    run: (c) => rows(c, `UPDATE profiles SET phone = '(00) 90000-0000', full_name = 'ACE A editado' WHERE auth_user_id = auth.uid()`), works: (r) => r.ok && r.value === 1 },
  { id: 'R9', kind: 'regressao', who: 'root', title: 'SUPER_ADMIN (plataforma) lê imóveis de outro município',
    run: (c) => count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_B]), works: (r) => r.ok && r.value === 2 },
  { id: 'R10', kind: 'regressao', who: 'aceA', title: 'Bootstrap da sessão do ACE (perfil, município, papel, permissões)',
    run: async (c) => (await one(c, `SELECT get_auth_bootstrap() AS b`)).b,
    works: (r) => r.ok && r.value.municipality?.id === MUN_A && r.value.roles?.[0]?.slug === 'ACE' && r.value.permissions?.length === 15 },
  { id: 'R11', kind: 'regressao', who: 'supA', title: 'Bootstrap da sessão do supervisor',
    run: async (c) => (await one(c, `SELECT get_auth_bootstrap() AS b`)).b,
    works: (r) => r.ok && r.value.roles?.[0]?.slug === 'FIELD_SUPERVISOR' && r.value.permissions?.length === 36 },
  { id: 'R12', kind: 'regressao', who: 'adminA', title: 'Bootstrap da sessão do admin municipal',
    run: async (c) => (await one(c, `SELECT get_auth_bootstrap() AS b`)).b,
    works: (r) => r.ok && r.value.roles?.[0]?.slug === 'MUNICIPAL_ADMIN' && r.value.permissions?.length === 55 },
  { id: 'R13', kind: 'regressao', who: 'stranger', title: 'Cadastro público sem perfil ativo não entra (account_inactive)',
    run: async (c) => (await one(c, `SELECT get_auth_bootstrap() AS b`)).b, works: (r) => !r.ok && /account_inactive|profile_not_found/.test(r.error) },
  { id: 'R14', kind: 'regressao', who: 'adminA', title: 'Admin de A altera configurações do próprio município',
    run: (c) => rows(c, `UPDATE system_settings SET setting_value = '{"nome":"A2"}' WHERE municipality_id = $1`, [MUN_A]), works: (r) => r.ok && r.value === 1 },
  { id: 'R15', kind: 'regressao', who: 'adminA', title: 'Admin de A lê logs de erro do próprio município',
    run: (c) => count(c, `SELECT count(*) n FROM system_error_logs WHERE municipality_id = $1`, [MUN_A]), works: (r) => r.ok && r.value === 1 },
  { id: 'R16', kind: 'regressao', who: 'aceA', title: 'ACE registra log de erro do próprio município',
    run: (c) => rows(c, `INSERT INTO system_error_logs (municipality_id, request_id, page, action, error_message) VALUES ($1,'r','/','x','y')`, [MUN_A]), works: (r) => r.ok && r.value === 1 },
  { id: 'R17', kind: 'regressao', who: 'aceA', title: 'ACE registra auditoria com a própria autoria',
    run: async (c) => { await c.query(`INSERT INTO audit_logs (municipality_id, user_id, action, module, entity) VALUES ($1, $2, 'PROPRIO', 'teste', 'teste')`, [MUN_A, users.aceA.profile]);
      await c.query('RESET ROLE'); return (await one(c, `SELECT user_id FROM audit_logs WHERE action = 'PROPRIO'`)).user_id; },
    works: (r) => r.ok && r.value === users.aceA.profile },
  { id: 'R18', kind: 'regressao', who: 'adminA', title: 'Admin municipal registra simulação de perfil (auditoria)',
    run: (c) => c.query(`SELECT log_impersonation('ACE')`).then(() => 'ok'), works: (r) => r.ok },
  { id: 'R19', kind: 'regressao', who: 'root', title: 'SUPER_ADMIN altera a matriz global de permissões',
    run: (c) => c.query(`SELECT set_role_permissions('AUDITOR_VIEWER', ARRAY['auditoria.view','visitas.view'])`).then(() => 'ok'), works: (r) => r.ok },
  { id: 'R20', kind: 'regressao', who: 'adminA', title: 'Admin de A vincula usuário como agente (tabela agents)',
    run: (c) => rows(c, `INSERT INTO agents (municipality_id, profile_id) VALUES ($1, $2)`, [MUN_A, users.ace2A.profile]), works: (r) => r.ok && r.value === 1 },
  { id: 'R21', kind: 'regressao', who: 'adminB', title: 'Admin de B lê o próprio município e nada de A',
    run: async (c) => ({ own: await count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_B]), other: await count(c, `SELECT count(*) n FROM properties WHERE municipality_id = $1`, [MUN_A]) }),
    works: (r) => r.ok && r.value.own === 2 && r.value.other === 0 },
  { id: 'R22', kind: 'regressao', who: 'root', title: 'SUPER_ADMIN altera configurações de qualquer município',
    run: (c) => rows(c, `UPDATE system_settings SET setting_value = '{"nome":"B2"}' WHERE municipality_id = $1`, [MUN_B]), works: (r) => r.ok && r.value === 1 },

  // ---------------- Encaminhamentos (migração 32)
  { id: 'E1', kind: 'regressao', who: 'supA', requires: 'intersectoral_referrals', title: 'Supervisor cria e lê encaminhamento no próprio município',
    run: async (c) => { await c.query(`INSERT INTO intersectoral_referrals (municipality_id, protocol, target_sector, property_address, description, issued_by) VALUES ($1,'ENC-T-1','SANEAMENTO','Rua A, 1','Descarte irregular',$2)`, [MUN_A, users.supA.profile]);
      return count(c, `SELECT count(*) n FROM intersectoral_referrals`); }, works: (r) => r.ok && r.value === 1 },
  { id: 'E2', kind: 'exploit', who: 'supA', requires: 'intersectoral_referrals', title: 'Supervisor de A cria encaminhamento no município B',
    run: (c) => rows(c, `INSERT INTO intersectoral_referrals (municipality_id, protocol, target_sector, property_address, description) VALUES ($1,'ENC-T-2','SANEAMENTO','Rua B','x')`, [MUN_B]), vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'E3', kind: 'exploit', who: 'adminB', requires: 'intersectoral_referrals', title: 'Admin de B lê encaminhamentos de A',
    run: async (c) => { await c.query('RESET ROLE'); await c.query(`INSERT INTO intersectoral_referrals (municipality_id, protocol, target_sector, property_address, description) VALUES ($1,'ENC-T-3','SANEAMENTO','Rua A','x')`, [MUN_A]); await c.query('SET LOCAL ROLE authenticated');
      return count(c, `SELECT count(*) n FROM intersectoral_referrals WHERE municipality_id = $1`, [MUN_A]); }, vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'E4', kind: 'exploit', who: 'supA', requires: 'intersectoral_referrals', title: 'Encaminhamento pode ser apagado (deveria ser retido)',
    run: async (c) => { await c.query(`INSERT INTO intersectoral_referrals (municipality_id, protocol, target_sector, property_address, description) VALUES ($1,'ENC-T-4','SANEAMENTO','Rua A','x')`, [MUN_A]);
      return rows(c, `DELETE FROM intersectoral_referrals WHERE protocol = 'ENC-T-4'`); }, vulnerable: (r) => r.ok && r.value > 0 },
  { id: 'E5', kind: 'exploit', who: 'aceA', requires: 'intersectoral_referrals', title: 'ACE (sem denuncias.manage) cria encaminhamento',
    run: (c) => rows(c, `INSERT INTO intersectoral_referrals (municipality_id, protocol, target_sector, property_address, description) VALUES ($1,'ENC-T-5','SANEAMENTO','Rua A','x')`, [MUN_A]), vulnerable: (r) => r.ok && r.value > 0 },
];

export async function runAll(c) {
  await loadIds(c);
  await loadRefIds(c);
  const out = [];
  for (const t of tests) {
    if (t.requires && !(await tableExists(c, t.requires))) { out.push({ id: t.id, kind: t.kind, title: t.title, skipped: true }); continue; }
    const r = await as(c, t.who, t.run);
    const entry = { id: t.id, kind: t.kind, who: t.who, title: t.title, result: r };
    if (t.kind === 'exploit') entry.vulnerable = t.vulnerable(r);
    else entry.works = t.works(r);
    out.push(entry);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('sectest.mjs')) {
  const c = await connect();
  if ('seed' in args) await seed(c);
  const out = await runAll(c);
  writeFileSync(new URL(`./results-${label}.json`, import.meta.url), JSON.stringify(out, null, 2));
  for (const e of out) {
    if (e.skipped) { console.log(`--   ${e.id.padEnd(4)} (sem tabela) ${e.title}`); continue; }
    const status = e.kind === 'exploit' ? (e.vulnerable ? 'VULNERÁVEL' : 'bloqueado') : (e.works ? 'ok' : 'FALHOU');
    const detail = e.result.ok ? JSON.stringify(e.result.value) : e.result.error;
    console.log(`${status.padEnd(10)} ${e.id.padEnd(4)} [${e.who}] ${e.title} -> ${String(detail).slice(0, 110)}`);
  }
  await c.end();
}
