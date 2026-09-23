// Controle do PostgreSQL local de homologação (binários do pacote embedded-postgres).
// Uso: node server.mjs init|start|stop|status
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
const data = process.env.PGH_DATA || join(here, 'data');
export const PORT = 54329;

const run = (exe, args) => {
  try {
    return execFileSync(join(bin, exe), args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '') + `\n[exit ${e.status}]`;
  }
};

const cmd = process.argv[1] && basename(process.argv[1]) === 'server.mjs' ? process.argv[2] : null;
if (cmd === 'init') {
  if (existsSync(join(data, 'PG_VERSION'))) {
    console.log('cluster já inicializado');
  } else {
    mkdirSync(data, { recursive: true });
    console.log(run('initdb.exe', ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C']).split('\n').slice(-4).join('\n'));
  }
} else if (cmd === 'start') {
  // pg_ctl deixa o postgres herdando os handles; spawn destacado evita travar o processo Node
  const child = spawn(join(bin, 'pg_ctl.exe'), ['-D', data, '-l', join(here, 'pg.log'), '-o', `-p ${PORT} -c listen_addresses=127.0.0.1`, 'start'], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('start solicitado; verifique com: node server.mjs status');
} else if (cmd === 'stop') {
  console.log(run('pg_ctl.exe', ['-D', data, '-m', 'fast', '-w', 'stop']));
} else if (cmd === 'status') {
  console.log(run('pg_ctl.exe', ['-D', data, 'status']));
} else if (cmd !== null) {
  console.log('uso: node server.mjs init|start|stop|status');
}
