/**
 * ENDEMIAS GOV - Cria (ou promove) um usuário SUPER_ADMIN real no Supabase Auth
 * ------------------------------------------------------------------
 * Idempotente: se o e-mail já existir no Supabase Auth, apenas atualiza a
 * senha e garante profile ativo + papel SUPER_ADMIN (não duplica nada).
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/create-superadmin.mjs "<email>" "<senha>" ["Nome Completo"]
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY (Dashboard -> Settings -> API).
 * NUNCA versione essa chave nem a cole em locais persistidos/compartilhados.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const FULL_NAME = process.argv[4] || (EMAIL ? EMAIL.split('@')[0] : 'Super Administrador');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error('Uso: node scripts/create-superadmin.mjs "<email>" "<senha>" ["Nome Completo"]');
  process.exit(1);
}
if (PASSWORD.length < 8) {
  console.error('A senha deve ter no mínimo 8 caracteres (política do Endemias GOV).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page++;
  }
}

async function main() {
  // 1. Município de destino (o primeiro ativo — SUPER_ADMIN enxerga todos via is_platform_admin())
  const { data: mun, error: munErr } = await admin
    .from('municipalities')
    .select('id, name')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (munErr) throw munErr;
  if (!mun) throw new Error('Nenhum município ativo encontrado — cadastre um antes de rodar este script.');

  // 2. Cria (ou localiza) o usuário no Supabase Auth
  let authUserId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });

  if (createErr) {
    const alreadyExists = /already.*registered|already.*exists/i.test(createErr.message || '');
    if (!alreadyExists) throw createErr;

    console.log('E-mail já existe no Supabase Auth — localizando e atualizando a senha...');
    const existing = await findAuthUserByEmail(EMAIL);
    if (!existing) throw new Error('Conflito de criação, mas usuário não encontrado na listagem.');
    authUserId = existing.id;

    const { error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    });
    if (updErr) throw updErr;
  } else {
    authUserId = created.user.id;
  }

  // 3. Profile — o trigger on_auth_user_created (migration 25) pode já ter criado um
  //    esqueleto inativo. Localiza por auth_user_id e ativa; senão, cria.
  const { data: existingProfile, error: profSelErr } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (profSelErr) throw profSelErr;

  let profileId;
  if (existingProfile) {
    profileId = existingProfile.id;
    const { error: profUpdErr } = await admin
      .from('profiles')
      .update({ full_name: FULL_NAME, email: EMAIL, active: true, municipality_id: mun.id })
      .eq('id', profileId);
    if (profUpdErr) throw profUpdErr;
  } else {
    const { data: inserted, error: profInsErr } = await admin
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        municipality_id: mun.id,
        full_name: FULL_NAME,
        email: EMAIL,
        active: true,
      })
      .select('id')
      .single();
    if (profInsErr) throw profInsErr;
    profileId = inserted.id;
  }

  // 4. Vincula o papel SUPER_ADMIN
  const { data: role, error: roleErr } = await admin
    .from('roles')
    .select('id')
    .eq('slug', 'SUPER_ADMIN')
    .single();
  if (roleErr) throw roleErr;

  const { error: linkErr } = await admin
    .from('user_roles')
    .upsert({ user_id: profileId, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
  if (linkErr) throw linkErr;

  console.log('\n✔ Usuário SUPER_ADMIN pronto:');
  console.log(`  E-mail:      ${EMAIL}`);
  console.log(`  Nome:        ${FULL_NAME}`);
  console.log(`  Município:   ${mun.name}`);
  console.log(`  auth_user_id: ${authUserId}`);
  console.log(`  profile_id:   ${profileId}`);
  console.log('\nJá pode fazer login normalmente pela tela de login do Endemias GOV.');
}

main().catch((e) => {
  console.error('Falha ao criar/promover SUPER_ADMIN:', e.message || e);
  process.exit(1);
});
