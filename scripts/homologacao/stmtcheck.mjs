// Executa um arquivo SQL comando a comando (sem transação externa) e mostra o primeiro erro.
import pg from 'pg'; import fs from 'node:fs';
const c = new pg.Client({ host: '127.0.0.1', port: 54329, user: 'postgres', database: 'homolog' }); await c.connect();
const sql = fs.readFileSync(process.argv[2], 'utf8');
let parts = [], cur = '', inDollar = false, inStr = false, inComment = false;
for (let i = 0; i < sql.length; i++) {
  const ch = sql[i], n2 = sql.slice(i, i + 2);
  if (inComment) { cur += ch; if (ch === '\n') inComment = false; continue; }
  if (!inDollar && !inStr && n2 === '--') { inComment = true; cur += ch; continue; }
  if (!inStr && n2 === '$$') { inDollar = !inDollar; cur += '$$'; i++; continue; }
  if (!inDollar && ch === "'") inStr = !inStr;
  cur += ch; if (!inDollar && !inStr && ch === ';') { parts.push(cur); cur = ''; }
}
for (const [i, p] of parts.entries()) {
  if (/^\s*(--[^\n]*\n\s*)*(BEGIN|COMMIT);\s*$/i.test(p)) continue;
  try { await c.query(p); } catch (e) { console.log(`#${i} ERRO ${e.code} ${e.message}\n${p.trim().slice(0, 300)}`); process.exitCode = 1; break; }
}
await c.end();
