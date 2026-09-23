# Homologação local do banco

Reproduz o banco do Supabase em um PostgreSQL 15 local, sem Docker e sem credenciais. Serve para aplicar as migrações e comprovar as regras de segurança (RLS e RPC) antes de publicá-las no projeto real.

O arquivo `shim.sql` recria a linha de base de um projeto Supabase:

- os papéis `anon`, `authenticated`, `service_role` e `supabase_auth_admin`;
- `auth.users` e as funções `auth.uid()`, `auth.jwt()` e `auth.role()`;
- `pgcrypto` e `uuid-ossp` instaladas no esquema `extensions`, como no Supabase;
- os privilégios padrão do esquema `public`.

Os testes simulam o PostgREST: cada caso roda numa transação com `request.jwt.claims` e `SET LOCAL ROLE authenticated` (ou `anon`) e termina em `ROLLBACK`.

## Uso (Windows, Node 20+)

```powershell
cd scripts/homologacao
npm install          # instala o PostgreSQL embutido só nesta pasta (~100 MB)
npm run init         # cria o cluster em ./data
npm run start        # porta 54329, somente 127.0.0.1
npm run antes        # migrações 01–30 + dados de teste + testes (estado atual do projeto)
npm run depois       # aplica 31+ sobre o mesmo banco + testes
npm run instalacao-limpa   # instalação do zero com todas as migrações
npm run stop
```

`npm run sondar-producao` testa todas as consultas de leitura do frontend contra o projeto real. Usa apenas `GET` com `limit=0` e a chave anônima do `.env`; o anônimo não tem acesso às tabelas, então nenhum dado é lido. A resposta mostra se o esquema está correto ou se a coluna ou relação não existe.

## Resultado registrado (23/09/2026)

| Execução | Exploits comprovados | Regressões |
|---|---|---|
| Antes (migrações 01–30) | 20 funcionando | 4 falhas |
| Depois (+ 31–35) | 0 (26 bloqueados) | 0 falhas (28 ok) |

Detalhes em `docs/ACE-GOV-AUDITORIA-E-EXECUCAO.md`, seção 10.
