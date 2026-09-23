#!/usr/bin/env node
/**
 * Lista o link oficial do Portal do Cidadão de cada município ativo.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL="https://<projeto>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"     # nunca commitar
 *   node scripts/portal-links.mjs --app-url=https://<endereco-publicado-do-painel>
 *
 * O link é <app-url>/publico?municipio=<uuid>. O mesmo link aparece em
 * Administração > Configurações ("Link oficial do Portal do Cidadão").
 * Para um único município por implantação, defina VITE_PUBLIC_MUNICIPALITY_ID
 * no ambiente de build e divulgue apenas <app-url>/publico.
 */
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=')];
}));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (args['app-url'] || '').replace(/\/+$/, '');
if (!url || !key) { console.error('Erro: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
if (!/^https?:\/\//.test(appUrl)) { console.error('Erro: informe --app-url=https://... (endereço publicado do painel).'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.from('municipalities').select('id, name, state, ibge_code').eq('active', true).order('name');
if (error) { console.error(`Erro: ${error.message}`); process.exit(1); }

const EXAMPLE = '00000000-0000-0000-0000-000000000001';
for (const m of data) {
  const note = m.id === EXAMPLE ? '  (município de exemplo das migrações: não divulgar)' : '';
  console.log(`${m.name}/${m.state} (IBGE ${m.ibge_code})${note}\n  ${appUrl}/publico?municipio=${m.id}\n  consulta de protocolo: ${appUrl}/publico/denuncia/acompanhar?municipio=${m.id}\n`);
}
