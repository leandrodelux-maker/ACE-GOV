// Sonda somente-leitura (GET, limit=0) de todas as consultas de leitura no projeto real.
import { readFileSync, writeFileSync } from 'node:fs';
import { REPO } from './apply.mjs';
const env = Object.fromEntries(readFileSync(`${REPO}/.env`, 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
// Igual ao supabase-js: remove espaços fora de aspas
const clean = (s) => { let q = false; return s.split('').map((c) => { if (/\s/.test(c) && !q) return ''; if (c === '"') q = !q; return c; }).join(''); };
const queries = JSON.parse(readFileSync(new URL('./all-queries.json', import.meta.url), 'utf8')).filter((q) => !q.isWrite);
const seen = new Map();
const results = [];
for (const q of queries) {
  const params = new URLSearchParams({ select: clean(q.select || '*'), limit: '0' });
  for (const f of new Set(q.filters)) params.append(f, 'is.null');
  if (q.orders.length) params.set('order', [...new Set(q.orders)].join(','));
  const key = `${q.table}?${params}`;
  let r = seen.get(key);
  if (!r) {
    const resp = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${q.table}?${params}`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } });
    let code = '', msg = '';
    try { const j = JSON.parse(await resp.text()); code = j.code || ''; msg = j.message || ''; } catch { /* sem corpo */ }
    r = { status: resp.status, code, msg: msg.slice(0, 160), schemaError: ['PGRST200', 'PGRST201', 'PGRST100', '42703', '42P01', 'PGRST205', '42883'].includes(code) };
    seen.set(key, r);
    await new Promise((res) => setTimeout(res, 80));
  }
  results.push({ ...q, ...r });
}
writeFileSync(new URL('./probe-results.json', import.meta.url), JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.schemaError);
for (const b of bad) console.log(`${b.code.padEnd(9)} ${b.tag} :: ${b.table} -> ${b.msg}`);
const other = results.filter((r) => !r.schemaError && !['42501', ''].includes(r.code));
for (const o of other) console.log(`OUTRO ${o.status} ${o.code} ${o.tag} -> ${o.msg}`);
console.log(`\n${results.length} leituras sondadas (${seen.size} distintas): ${bad.length} com erro de esquema; ${other.length} com outro código`);
