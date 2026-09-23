// Confere as chaves dos objetos literais em .insert/.update/.upsert contra o esquema real.
import { connect, REPO } from './apply.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const c = await connect();
const cols = new Map();
const required = new Map();
for (const r of (await c.query(`SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public'`)).rows) {
  if (!cols.has(r.table_name)) { cols.set(r.table_name, new Set()); required.set(r.table_name, new Set()); }
  cols.get(r.table_name).add(r.column_name);
  if (r.is_nullable === 'NO' && r.column_default === null) required.get(r.table_name).add(r.column_name);
}
await c.end();

const files = [];
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p); } })(join(REPO, 'src'));

// Lê um objeto literal a partir de src[i] === '{' e devolve { keys, end, spread }
function readObject(src, i) {
  let depth = 0, keys = [], spread = false, token = '', inStr = null;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (inStr) { if (ch === '\\') { j++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; if (depth === 1) token = ''; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) { const t = token.trim(); if (/^\w+$/.test(t)) keys.push(t); return { keys, end: j, spread }; } continue; }
    if (depth === 1) {
      if (ch === ':') { const t = token.trim(); if (/^\w+$/.test(t)) keys.push(t); token = '\0'; continue; }
      if (ch === ',') { const t = token.trim(); if (t !== '\0' && /^\w+$/.test(t)) keys.push(t); if (t.startsWith('...')) spread = true; token = ''; continue; }
      if (token !== '\0') token += ch;
      if (token.trim().startsWith('...')) spread = true;
    }
  }
  return { keys, end: src.length, spread };
}

const problems = [];
let checked = 0, dynamic = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const re = /\.from\(\s*['"](\w+)['"]\s*\)\s*\.(insert|update|upsert)\(\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const [, table, op] = m;
    const line = src.slice(0, m.index).split('\n').length;
    const tag = `${relative(REPO, file)}:${line}`;
    if (!cols.has(table)) { problems.push(`${tag} ${op} em tabela inexistente '${table}'`); continue; }
    let i = m.index + m[0].length;
    if (src[i] === '[') i = src.indexOf('{', i);
    if (src[i] !== '{') { dynamic++; continue; }
    const { keys, spread } = readObject(src, i);
    checked++;
    const bad = keys.filter((k) => !cols.get(table).has(k));
    if (bad.length) problems.push(`${tag} ${op} ${table}: coluna(s) inexistente(s) ${bad.join(', ')}`);
    if (op === 'insert' && !spread) {
      const missing = [...required.get(table)].filter((k) => !keys.includes(k));
      if (missing.length) problems.push(`${tag} insert ${table}: obrigatória(s) ausente(s) ${missing.join(', ')}`);
    }
  }
}
console.log(problems.join('\n') || 'nenhum problema');
console.log(`\n${checked} objetos literais conferidos; ${dynamic} payloads dinâmicos (não conferidos); ${problems.length} problema(s)`);
