// Recria o banco "homolog", aplica a linha de base Supabase e as migrações em ordem.
// Uso: node apply.mjs [--upto=<prefixo>] [--extra=<arquivo.sql>,...]
//   --upto   para depois da migração cujo nome começa com o prefixo (ex.: 20260913000030)
//   --extra  arquivos adicionais aplicados depois (ex.: migrações propostas)
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = join(here, '..', '..'); // raiz do repositório
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

export const connect = async (database = 'homolog') => {
  const c = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', database });
  await c.connect();
  return c;
};

export async function recreate() {
  const admin = await connect('postgres');
  await admin.query('DROP DATABASE IF EXISTS homolog WITH (FORCE)');
  // Os papéis são globais ao cluster: remove para a linha de base recriá-los
  for (const r of ['anon', 'authenticated', 'service_role', 'supabase_auth_admin']) {
    await admin.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${r}') THEN
      EXECUTE 'DROP OWNED BY ${r} CASCADE'; EXECUTE 'DROP ROLE ${r}'; END IF; END $$`).catch(() => {});
  }
  await admin.query('CREATE DATABASE homolog');
  await admin.end();
}

export async function applyFile(c, file) {
  const sql = readFileSync(file, 'utf8');
  const t0 = Date.now();
  try {
    // Arquivos sem BEGIN/COMMIT próprio rodam numa transação implícita (como o db push)
    await c.query(sql);
    return { file: basename(file), ok: true, ms: Date.now() - t0 };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    return { file: basename(file), ok: false, error: `${e.code || ''} ${e.message}`, where: e.where, position: e.position };
  }
}

if (process.argv[1] && basename(process.argv[1]) === 'apply.mjs') {
  await recreate();
  const c = await connect();
  const results = [await applyFile(c, join(here, 'shim.sql'))];
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const r = await applyFile(c, join(dir, f));
    results.push(r);
    if (!r.ok) break;
    if (args.upto && f.startsWith(args.upto)) break;
  }
  if (results.every((r) => r.ok) && args.extra) {
    for (const f of args.extra.split(',')) {
      const r = await applyFile(c, f);
      results.push(r);
      if (!r.ok) break;
    }
  }
  for (const r of results) console.log(r.ok ? `OK   ${r.file} (${r.ms} ms)` : `FAIL ${r.file}: ${r.error}${r.where ? `\n     where: ${r.where}` : ''}`);
  await c.end();
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
