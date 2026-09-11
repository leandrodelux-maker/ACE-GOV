# scripts/

## create-superadmin.mjs

Cria (ou promove) uma conta real no Supabase Auth com o papel `SUPER_ADMIN`.
Idempotente — pode rodar de novo para trocar a senha de um SUPER_ADMIN existente.

```bash
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
node scripts/create-superadmin.mjs "email@dominio.com" "SenhaForte123!" "Nome Completo"
```

Requer `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API → `service_role`).
**Nunca** cole essa chave em commits, PRs, tickets ou no chat — ela ignora toda a RLS.

## provision-auth-users.mjs

Cria contas no **Supabase Auth** para os `profiles` municipais existentes e as
vincula (via trigger `on_auth_user_created`, migration 25).

### Pré-requisitos
- Migrations `20260907000023` a `20260907000025` já aplicadas.
- `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API). **Nunca versionar.**

### Execução

```bash
# 1. Ver o que seria feito
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
node scripts/provision-auth-users.mjs --dry-run

# 2a. Produção com servidores reais — enviar convites por e-mail
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/provision-auth-users.mjs --invite

# 2b. OU criar com senha temporária (gera CSV local)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/provision-auth-users.mjs
```

O modo senha-temporária grava `provisioned-users-<ts>.csv` com as senhas.
Distribua por canal seguro, exija troca no primeiro acesso e **apague o CSV**.

### Depois de provisionar
- Confirme: `select email, auth_user_id from profiles where active;` — nenhum `null`.
- Teste `select public.get_auth_bootstrap();` autenticado como um usuário real.
- Prossiga com o Workstream C (frontend) e depois as migrations 26/27/28.

## Configuração manual no Dashboard (Workstream A7)
- **Authentication → Providers → Email:** desativar "Enable Signup" (usuários só por convite/admin).
- **Authentication → Sessions:** *time-box* e *inactivity timeout* = 30 dias; JWT expiry = 3600 s; ativar *refresh token rotation*.
- **Authentication → Hooks → Custom Access Token:** (opcional) selecionar `public.custom_access_token_hook` (migration 29).
- **Settings → API:** rotacionar a `anon` key após a migration 26 e atualizar `VITE_SUPABASE_ANON_KEY` no deploy.
