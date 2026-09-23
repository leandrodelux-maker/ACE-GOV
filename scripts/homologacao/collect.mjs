// Coleta TODAS as consultas .from('t').select(...).filtros do frontend (sem validar)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO } from './apply.mjs';
const files = [];
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p); } })(join(REPO, 'src'));
const out = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const re = /\.from\(\s*['"](\w+)['"]\s*\)/g; let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length; const next = src.indexOf('.from(', start);
    const chain = src.slice(start, Math.min(next === -1 ? src.length : next, start + 1500));
    // corta a cadeia no fim da instrução (ponto e vírgula ou fechamento de Promise.all)
    const stmtEnd = chain.search(/;\s*\n|\n\s*\]\);|\),\s*\n\s*supabase/);
    const c = stmtEnd > 0 ? chain.slice(0, stmtEnd + 1) : chain;
    const sel = c.match(/^\s*\.select\(\s*(['"`])([\s\S]*?)\1/) || c.match(/\.select\(\s*(['"`])([\s\S]*?)\1/);
    const isWrite = /^\s*\.(insert|update|upsert|delete)\(/.test(c);
    const select = sel && !sel[2].includes('${') ? sel[2] : (isWrite ? null : '*');
    const filters = [...c.matchAll(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|not)\(\s*['"]([\w.]+)['"]/g)].map((f) => f[2]);
    const orders = [...c.matchAll(/\.order\(\s*['"]([\w.]+)['"]/g)].map((f) => f[1]);
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ tag: `${relative(REPO, file)}:${line}`, table: m[1], select, filters, orders, isWrite });
  }
}
writeFileSync(new URL('./all-queries.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.length, 'consultas;', out.filter((q) => q.isWrite).length, 'escritas (não sondadas)');
