import { createClient } from '@supabase/supabase-js';

// As credenciais vêm EXCLUSIVAMENTE das variáveis de ambiente. Não há fallback
// hardcoded — em produção, RLS é a porta e a chave anônima precisa ser
// rotacionável sem alterar código.
//
// Em runtime de navegador (Vite) vêm de import.meta.env; em scripts Node
// (ex.: `npm run test` via tsx) vêm de process.env, carregado do .env pelo
// `dotenv/config` importado no topo do entrypoint (ver src/tests/testSuite.ts).
const metaEnv = (import.meta as any).env || {};
const nodeEnv = typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>);
const supabaseUrl: string | undefined = metaEnv.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = metaEnv.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente (.env). ' +
      'Consulte .env.example.'
  );
}

// Cliente oficial Supabase para o Endemias GOV.
// A sessão é gerida pelo Supabase Auth (persistência + refresh automático).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'endemias_gov_sb_auth',
  },
});
