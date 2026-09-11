/**
 * ENDEMIAS GOV - Provisionamento de contas no Supabase Auth
 * ------------------------------------------------------------------
 * Cria uma conta em `auth.users` para cada `profiles` ativo que ainda não
 * tem `auth_user_id`. O trigger `on_auth_user_created` (migration 25) faz o
 * vínculo automaticamente pelo e-mail.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/provision-auth-users.mjs [--invite]
 *
 *   (sem flag)  cria a conta com senha temporária aleatória (grava CSV)
 *   --invite    envia e-mail de convite do Supabase (não gera senha)
 *   --dry-run   apenas lista o que seria feito
 *
 * NUNCA versione o service_role key. Rode uma única vez, a partir de máquina segura.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE_INVITE = process.argv.includes('--invite');
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tempPassword() {
  // 18 chars, base64url — atende a política mínima de 8+ e alta entropia
  return randomBytes(14).toString('base64url');
}

async function main() {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, email, active, auth_user_id')
    .is('auth_user_id', null)
    .eq('active', true);

  if (error) {
    console.error('Falha ao ler profiles:', error.message);
    process.exit(1);
  }

  if (!profiles.length) {
    console.log('Nada a provisionar — todos os profiles ativos já têm auth_user_id.');
    return;
  }

  console.log(`${profiles.length} profile(s) a provisionar (modo: ${MODE_INVITE ? 'invite' : 'senha temporária'}).`);
  const rows = [['email', 'full_name', 'status', 'temp_password']];

  for (const p of profiles) {
    if (DRY_RUN) {
      console.log(`  [dry-run] ${p.email}`);
      rows.push([p.email, p.full_name, 'dry-run', '']);
      continue;
    }

    try {
      if (MODE_INVITE) {
        const { error: e } = await admin.auth.admin.inviteUserByEmail(p.email, {
          data: { full_name: p.full_name },
        });
        if (e) throw e;
        console.log(`  ✔ convite enviado: ${p.email}`);
        rows.push([p.email, p.full_name, 'invited', '']);
      } else {
        const pwd = tempPassword();
        const { error: e } = await admin.auth.admin.createUser({
          email: p.email,
          password: pwd,
          email_confirm: true,
          user_metadata: { full_name: p.full_name, must_change_password: true },
        });
        if (e) throw e;
        console.log(`  ✔ criado: ${p.email}`);
        rows.push([p.email, p.full_name, 'created', pwd]);
      }
    } catch (e) {
      console.error(`  x falha ${p.email}: ${e.message}`);
      rows.push([p.email, p.full_name, `error: ${e.message}`, '']);
    }
  }

  if (!MODE_INVITE && !DRY_RUN) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const file = `provisioned-users-${Date.now()}.csv`;
    writeFileSync(file, csv, 'utf8');
    console.log(`\nSenhas temporárias em ${file} — distribua com segurança e exija troca no 1º acesso. APAGUE o arquivo depois.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
