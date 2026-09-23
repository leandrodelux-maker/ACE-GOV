// Aplica as migrações novas (31+) sobre o banco já populado (caminho de atualização real)
import { connect, applyFile, REPO } from './apply.mjs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const c = await connect();
const dir = join(REPO, 'supabase', 'migrations');
for (const f of readdirSync(dir).filter((f) => f >= '20260923').sort()) {
  const r = await applyFile(c, join(dir, f));
  console.log(r.ok ? `OK   ${r.file} (${r.ms} ms)` : `FAIL ${r.file}: ${r.error}\n     ${r.where || ''}`);
  if (!r.ok) process.exitCode = 1;
}
await c.end();
