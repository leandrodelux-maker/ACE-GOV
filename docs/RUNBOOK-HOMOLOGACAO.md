# Runbook — publicar as correções no Supabase e homologar com login

Estes passos exigem credenciais do projeto Supabase que não estão neste repositório: a senha do banco ou um token da CLI, e a chave `service_role`. **Nunca** coloque essas credenciais em arquivos versionados nem no `.env` do frontend.

Tudo o que dava para validar sem essas credenciais já foi validado na homologação local (`scripts/homologacao/`). O resultado está no relatório, seção 10.

---

## 1. Aplicar as migrações 31 a 35 (homologação primeiro, depois produção)

| Migração | O que faz | Risco |
|---|---|---|
| `20260923000031_tenant_isolation_hardening.sql` | Corrige os achados S1–S10 de isolamento entre municípios e escalada de privilégio | Muda o comportamento do admin municipal: deixa de ver outros municípios e de editar a matriz global de permissões. É o comportamento desejado. |
| `20260923000032_intersectoral_referrals.sql` | Cria a tabela de encaminhamentos | Aditiva |
| `20260923000033_public_portal_complaint_token.sql` | Faz o Portal do Cidadão voltar a gravar denúncias | Substitui só uma função |
| `20260923000034_agents_link_and_write_policy.sql` | Cria o cadastro de agente de cada ACE ativo; restringe a escrita em `agents` | Aditiva (backfill idempotente) |
| `20260923000035_deprecate_unused_tables.sql` | Marca Capacitações e Metas como descontinuadas; leitura mantida, escrita bloqueada | Reversível |

### 1.1 Backup
No painel do Supabase, abra **Database › Backups** e confirme que existe um backup recente. Opcionalmente, gere uma cópia extra:

```powershell
npx supabase db dump --db-url "<connection string>" -f backup-antes-31.sql
```

### 1.2 Ambiente de homologação
Use um projeto Supabase separado ou um *branch* do projeto. Não use o de produção.

```powershell
npx supabase login                      # abre o navegador; token fica fora do repositório
npx supabase link --project-ref <ref-da-homologacao>
npx supabase migration list             # confira o histórico remoto
```

**Atenção:** se as migrações 01–30 foram aplicadas pelo SQL Editor, o histórico remoto fica vazio e o `db push` tentaria reaplicar tudo. Nesse caso, marque as antigas como aplicadas antes do push:

```powershell
npx supabase migration repair --status applied 20260907000001 20260907000002 ... 20260913000030
npx supabase db push                    # aplica somente 31–35
```

### 1.3 Conferência após aplicar
Rode no SQL Editor, como `postgres`:

```sql
-- Admin municipal deixou de ser administrador da plataforma
SELECT pg_get_functiondef('public.is_platform_admin()'::regprocedure) LIKE '%ARRAY[''SUPER_ADMIN'']%';   -- true
-- Todo ACE ativo tem cadastro de agente
SELECT count(*) FROM profiles p JOIN user_roles ur ON ur.user_id = p.id JOIN roles r ON r.id = ur.role_id AND r.slug = 'ACE'
 WHERE p.active AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.profile_id = p.id);                    -- 0
-- Tabela de encaminhamentos criada
SELECT to_regclass('public.intersectoral_referrals');                                                 -- intersectoral_referrals
```

Depois, faça a validação com login da seção 3. Se tudo passar, repita a seção 1 no projeto de **produção**.

**Ordem de publicação:** o frontend desta versão funciona antes e depois das migrações. Quando a tabela de encaminhamentos não existe, a tela usa o modo local com aviso. A ordem entre deploy do frontend e `db push` não importa.

---

## 2. Vincular cada ACE e divulgar o link do portal

- **ACE existentes:** a migração 34 cria o cadastro de agente automaticamente para todo perfil ativo com papel ACE.
- **ACE cadastrados depois:** use *Administração › Usuários › coluna "Agente de campo" › Vincular*.
- **Links do portal:**
  - na tela, em *Administração › Configurações › "Link oficial do Portal do Cidadão"*;
  - para todos os municípios de uma vez:

    ```powershell
    $env:SUPABASE_URL="https://<ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"
    node scripts/portal-links.mjs --app-url=https://<endereco-publicado>
    ```

- **Uma implantação por município:** defina `VITE_PUBLIC_MUNICIPALITY_ID` no build e divulgue apenas `<endereco>/publico`.
- **Não divulgue** o município de exemplo `00000000-0000-0000-0000-000000000001`. Ele vem das migrações de seed e o script o sinaliza.

---

## 3. Usuários de teste por perfil e roteiro de validação com login

```powershell
$env:SUPABASE_URL="https://<ref-da-homologacao>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"
node scripts/create-test-users.mjs --municipio=<uuid> --dominio=<dominio-que-voce-controla> --dry-run
node scripts/create-test-users.mjs --municipio=<uuid> --dominio=<dominio-que-voce-controla>
```

O script cria as contas ACE, Supervisor de Campo e Administrador Municipal:
- cada conta recebe perfil, papel, cadastro de agente (só o ACE) e login com e-mail confirmado;
- as senhas aparecem uma única vez no terminal;
- o script é idempotente.

Roteiro mínimo:

| Perfil | Verificar |
|---|---|
| ACE | O login abre em "Campo ACE". Registrar uma visita online, repetir em modo avião e reconectar: a fila sincroniza sem duplicar. A visita aparece em *Visitas*. Não há acesso a *Administração*. |
| Supervisor | Ver a Supervisão com OS e pendências do dia. Criar um encaminhamento em *Denúncias & Encaminhamentos*, sem o aviso de "modo local". |
| Admin municipal | Ver só o próprio município. Em *Usuários*, não consegue mudar o próprio papel. *Perfis e Permissões* aparece somente para leitura. *Integrações › IBGE › Sincronizar* preenche a população e a incidência aparece em *Epidemiologia*. |
| Cidadão (sem login) | `/publico?municipio=<uuid>`: registrar uma denúncia e receber protocolo e token; consultar o protocolo. |

Ao final, desative as contas de teste em *Administração › Usuários*.

**Cadastro público (sign-up):** o projeto aceita sign-up aberto (`disable_signup: false`).
- Com a migração 31, uma conta criada sem perfil pré-cadastrado não recebe perfil nem acesso.
- Se o fluxo de "primeiro acesso" não for usado, desative em *Authentication › Sign In / Providers › Allow new users to sign up*.

---

## 4. Integrações externas

| Integração | Situação | O que falta |
|---|---|---|
| **IBGE** (localidades e população) | **Funcionando**: API pública, sem credencial, testada | Nada |
| **SINAN** | Importação por arquivo (CSV exportado do SINAN) em *Epidemiologia › Importar* | Exportar o arquivo do SINAN. API direta exige convênio com o MS/SES |
| **e-SUS APS, GAL, SIVEP, CNES (API)** | Não implementados; a tela informa a indisponibilidade | Convênio, credenciais e documentação da API de cada órgão |
| **WhatsApp / SMS** | Não implementado; nenhum envio é simulado | Conta WhatsApp Business (Meta), número verificado, token de acesso, modelos de mensagem aprovados e uma Edge Function para guardar o token fora do navegador |

---

## 5. Rollback

- **Migração 31:** reaplicar as definições anteriores das funções e políticas, que estão nas migrações 23, 25 e 26.
  - `ALTER FUNCTION submit_official_visit_core RENAME TO submit_official_visit` só depois de `DROP FUNCTION public.submit_official_visit(jsonb)`.
  - Nenhum dado é alterado por ela.
- **Migração 35:** `GRANT INSERT, UPDATE, DELETE ON public.trainings, public.training_participants, public.management_targets TO authenticated;`
- **Migrações 32 e 34:** são aditivas. Os dados criados podem ficar.
