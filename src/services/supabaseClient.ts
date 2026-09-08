import { createClient } from '@supabase/supabase-js';

// Obtenção segura das variáveis de ambiente com fallback para o projeto ativo
const metaEnv = (import.meta as any).env || {};
const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL || 'https://aelgnzoevqupstjvsflp.supabase.co';
const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbGduem9ldnF1cHN0anZzZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMjQ5MDIsImV4cCI6MjEwMzgwMDkwMn0.QnVi0v0rXR_m-R76LDCtr17XS7fNZHlp91xlHRZWGeU';

// Cliente oficial Supabase para o Endemias GOV (somente permissões públicas / anônimas / autenticadas via RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
