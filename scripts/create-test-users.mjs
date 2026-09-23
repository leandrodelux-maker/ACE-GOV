#!/usr/bin/env node
/**
 * Cria usuários de TESTE por perfil (ACE, Supervisor de Campo, Administrador
 * Municipal) em um município, para validar os fluxos com login.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL="https://<projeto>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"     # nunca commitar
 *   node scripts/create-test-users.mjs --municipio=<uuid> --dominio=<dominio-de-email-que-voce-controla>
 *
 * Opções:
 *   --perfis=ACE,FIELD_SUPERVISOR,MUNICIPAL_ADMIN   (padrão: os três)
 *   --dry-run                                        mostra o que faria, sem gravar
 *
 * O que faz, por perfil (idempotente: pula o que já existe):
 *   1. cria o perfil (profiles) no município, ativo, com o papel (user_roles);
 *   2. para ACE, cria o cadastro de agente (agents) — sem ele o ACE não grava visitas;
 *   3. cria a conta no Supabase Auth com e-mail confirmado e senha aleatória forte;
 *      o gatilho on_auth_user_created vincula a conta ao perfil pelo e-mail.
 * As senhas são exibidas UMA vez no terminal. Troque-as ou desative as contas
 * (Administração > Usuários) ao final da homologação.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const municipalityId = args.municipio;
const domain = args.dominio;
const roles = String(args.perfis || 'ACE,FIELD_SUPERVISOR,MUNICIPAL_ADMIN').split(',').map((s) => s.trim()).filter(Boolean);
const dryRun = !!args['dry-run'];

const fail = (msg) => { console.error(`Erro: ${msg}`); process.exit(1); };
if (!url || !serviceKey) fail('defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (não use o arquivo .env do frontend).');
if (!/^[0-9a-f-]{36}$/i.test(municipalityId || '')) fail('informe --municipio=<uuid do município>.');
if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) fail('informe --dominio=<domínio de e-mail que você controla> (ex.: prefeitura.gov.br).');
if (municipalityId === '00000000-0000-0000-0000-000000000001') fail('este é o UUID de exemplo das migrações; use o município real.');

const LABEL = { ACE: 'ace', FIELD_SUPERVISOR: 'supervisor', MUNICIPAL_ADMIN: 'admin', ENDEMIAS_COORDINATOR: 'coordenador' };
const NAME = { ACE: 'ACE (teste)', FIELD_SUPERVISOR: 'Supervisor de Campo (teste)', MUNICIPAL_ADMIN: 'Administrador Municipal (teste)', ENDEMIAS_COORDINATOR: 'Coordenador (teste)' };

const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const password = () => `${randomBytes(9).toString('base64url')}#A1`;

const { data: mun, error: munErr } = await sb.from('municipalities').select('id, name, state, active').eq('id', municipalityId).maybeSingle();
if (munErr) fail(munErr.message);
if (!mun) fail('município não encontrado.');
console.log(`Município: ${mun.name}/${mun.state}${mun.active ? '' : ' (INATIVO)'}${dryRun ? '  [dry-run]' : ''}\n`);

const results = [];
for (const role of roles) {
  if (!LABEL[role]) fail(`perfil não suportado: ${role}`);
  const email = `teste.${LABEL[role]}.${municipalityId.slice(0, 8)}@${domain}`.toLowerCase();
  const out = { role, email, profile: 'existente', agent: '-', auth: 'existente', password: '' };

  const { data: role_ } = await sb.from('roles').select('id').eq('slug', role).maybeSingle();
  if (!role_) fail(`papel ${role} não existe no banco.`);

  let { data: profile } = await sb.from('profiles').select('id, municipality_id, auth_user_id').ilike('email', email).maybeSingle();
  if (profile && profile.municipality_id !== municipalityId) fail(`${email} já existe em outro município.`);
  if (!profile && !dryRun) {
    const { data, error } = await sb.from('profiles')
      .insert({ municipality_id: municipalityId, full_name: NAME[role], email, active: true, job_title: 'Usuário de teste (homologação)' })
      .select('id, municipality_id, auth_user_id').single();
    if (error) fail(`perfil ${email}: ${error.message}`);
    profile = data;
    out.profile = 'criado';
  } else if (!profile) out.profile = 'criaria';

  if (profile && !dryRun) {
    const { error } = await sb.from('user_roles').upsert({ user_id: profile.id, role_id: role_.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
    if (error) fail(`papel de ${email}: ${error.message}`);
  }

  if (role === 'ACE') {
    const { data: agent } = profile ? await sb.from('agents').select('id').eq('profile_id', profile.id).maybeSingle() : { data: null };
    if (agent) out.agent = 'existente';
    else if (dryRun) out.agent = 'criaria';
    else {
      const { error } = await sb.from('agents').insert({ municipality_id: municipalityId, profile_id: profile.id, active: true });
      if (error) fail(`agente de ${email}: ${error.message}`);
      out.agent = 'criado';
    }
  }

  if (!profile?.auth_user_id) {
    if (dryRun) out.auth = 'criaria';
    else {
      const pwd = password();
      const { error } = await sb.auth.admin.createUser({ email, password: pwd, email_confirm: true, user_metadata: { full_name: NAME[role] } });
      if (error) fail(`conta ${email}: ${error.message}`);
      out.auth = 'criada';
      out.password = pwd;
    }
  }
  results.push(out);
}

console.table(results.map(({ password: _p, ...r }) => r));
const created = results.filter((r) => r.password);
if (created.length) {
  console.log('\nSenhas geradas (exibidas somente agora):');
  for (const r of created) console.log(`  ${r.role.padEnd(16)} ${r.email}  ${r.password}`);
}
console.log('\nPróximo passo: entre com cada conta e siga o roteiro em docs/RUNBOOK-HOMOLOGACAO.md (seção 3).');
