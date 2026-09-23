# ACE-GOV — Auditoria e Execução

**Data:** 23/09/2026 · **Base:** commit `66e5e93` (rodada 1), `df30647` (rodada 2, seção 9) · **Rodada 3 (seção 10):** branch próprio com pull request; sem deploy e sem alteração no banco real

Este documento registra o que foi auditado, o que foi corrigido no código e o que ainda depende de decisão ou de acesso externo (principalmente mudanças no banco Supabase).

---

## 1. Resumo

- **Removidos:** Central TV/Telão, Briefing Diário, Assistente IA, Capacitações e Cursos, página de Metas e Indicadores (telas, serviços, rotas, permissão exclusiva, catálogo auditado e dependência `@google/genai`).
- **Navegação:** menu reorganizado em 7 grupos; mapa central de rotas (`src/config/routes.ts`) usado por App, menu, hubs, busca e testes; URL como fonte única da tela (abertura direta, recarga e voltar/avançar); guarda de permissão **fail-closed** em todas as rotas internas.
- **Multimunicípio:** nenhum serviço ou tela usa mais o UUID de exemplo `00000000-0000-0000-0000-000000000001` como padrão; todos recebem o município da sessão.
- **Dados fabricados:** removidos de ~30 telas e serviços (incluindo alertas críticos fictícios, casos SINAN fictícios, agentes, equipes, integrações e envio de WhatsApp simulados). Sem dado, as telas mostram "Sem dados registrados" ou "Não foi possível carregar".
- **Banco:** nenhuma migração existente foi editada. As falhas de isolamento e escalada de privilégio (S1–S10 da seção 10) têm correção nas migrações **31–35**, versionadas em `supabase/migrations/`. As correções foram **comprovadas em homologação local**: 20 exploits funcionavam antes e todos ficaram bloqueados depois. Falta aplicá-las ao projeto Supabase real, o que exige credenciais (ver `docs/RUNBOOK-HOMOLOGACAO.md`).

### Resultado das validações

| Comando | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`, agora com `@types/react` e `strictNullChecks`) | 0 erros |
| `npm test` | **54/54** testes passando (eram 27 antes da rodada 1) |
| `npm run build` | build concluído; pacote inicial 376 kB (era ~1,7 MB), sem aviso de tamanho |
| Verificação com `rg` | nenhuma referência quebrada aos módulos removidos (restam apenas redirecionamentos legados, testes e uma nota no RBAC, todos intencionais) |
| Renderização real (Chrome headless sobre `vite preview`) | `/login` renderiza; `/publico` sem município mostra aviso; `/publico?municipio=<uuid>` carrega o portal; `/visitas`, `/tv` e `/` sem sessão caem no login sem expor telas internas |

**Limites da validação:** os testes usam o `.env` local (só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`). Não havia credenciais de usuário de teste, então **nenhum fluxo autenticado foi exercitado contra o banco real** (login, gravação de visitas, PWA, telas internas). A conectividade foi confirmada apenas como "o servidor respondeu" (HTTP 401 para a chave anônima, esperado com RLS).

---

## 2. Achados priorizados

Legenda: ✅ corrigido no código · 🔵 corrigido em migração versionada e validada em homologação local (aplicação no projeto real pendente de credenciais) · 🟡 corrigido parcialmente · 📝 registrado para decisão

### 2.1 Segurança e isolamento entre municípios

| ID | Gravidade | Achado | Situação |
|---|---|---|---|
| S1 | Crítica | `is_platform_admin()` retorna verdadeiro para `MUNICIPAL_ADMIN`. As políticas `is_platform_admin() OR municipality_id = current_user_municipality_id()` liberam a qualquer administrador municipal leitura e escrita em **todos os municípios**. | 🔵 Migração 31 |
| S2 | Crítica | Política `user_roles_write` só exige `usuarios.update`: permite atribuir qualquer papel, inclusive `SUPER_ADMIN`, a perfis de qualquer município. | 🔵 Migração 31 (mesmo município, sem autopromoção, `SUPER_ADMIN` só pela plataforma) e ✅ espelhado na tela de Usuários |
| S3 | Crítica | RPC `submit_official_visit` é `SECURITY DEFINER` e confia no `municipality_id`, `agent_id` e `property_id` enviados pelo navegador. | 🔵 Migração 31 |
| S4 | Alta | `role_permissions` é global; quem tem `perfis.manage` (administradores municipais) altera a matriz de papéis de todos os municípios. | 🔵 Migração 31 (inclui `roles_write` e `set_role_permissions`) e ✅ tela de Perfis somente leitura fora da plataforma |
| S5 | Alta | ~40 serviços e ~25 telas usavam o UUID de exemplo como município padrão; `supabaseService.getMunicipality()` escolhia "o primeiro município ativo". | ✅ Município da sessão obrigatório (`requireMunicipalityId`, `useMunicipalityId`); `getMunicipality()` removido |
| S6 | Alta | O PWA listava ovitrampas e ordens de serviço do município de exemplo; alertas de ovitrampa (≥ 80 ovos) eram criados no município de exemplo. | ✅ |
| S7 | Alta | ~20 rotas internas renderizavam sem checar permissão; o filtro do menu liberava o item quando a checagem lançava erro (falha aberta). | ✅ Guarda única `canAccessRoute` (fail-closed) em todas as rotas |
| S8 | Alta | Documentos eram **assinados digitalmente em nome de uma pessoa fictícia** fixa com o UUID de exemplo. | ✅ Assinatura sempre do usuário autenticado |
| S9 | Média | Supervisões gravadas com `supervisor_id` = UUID de exemplo. | ✅ Perfil do supervisor autenticado |
| S10 | Média | Consultas sem filtro de município (dependiam só de RLS): imóveis paginados, pendências, bloqueios, casos, insumos, criadouros, painel do supervisor. | ✅ Filtro explícito (a RLS continua sendo a barreira final) |
| S11 | Baixa | Usuário autenticado sem município vinculado era jogado de volta ao login (com sessão ativa). | ✅ Tela de bloqueio clara com opção de sair |

### 2.2 Integridade de dados e funcionamento

| ID | Achado | Situação |
|---|---|---|
| D1 | **Perda de visitas offline:** durante a sincronização do PWA, visitas finalizadas no meio do envio eram apagadas ao gravar a fila restante calculada antes. | ✅ `offlineVisitQueue.ts` relê a fila e remove só os IDs confirmados; teste automatizado |
| D2 | O PWA enviava o id do **perfil** como `agent_id`, mas `visits`, `ovitrap_installations` e `ovitrap_collections` referenciam `agents(id)` — gravações falhavam por FK quando os ids diferem. | ✅ Resolve `agents.id` do perfil (com cache offline); perfil sem cadastro de agente recebe mensagem clara e a visita fica na fila |
| D3 | O cabeçalho contava uma chave de fila inexistente (sempre 0) e o botão "sincronizar" copiava visitas para o `localStorage` anunciando "sincronizada com a base municipal". | ✅ Contador usa a fila real; botão leva ao PWA, onde o envio é real |
| D4 | A RPC grava `result = 'trabalhado'` (minúsculo); Sala de Situação e relatórios comparavam com `'TRABALHADO'` — visitas do PWA não contavam na cobertura. | ✅ Comparação normalizada |
| D5 | Cadastro de imóvel sem GPS **gravava coordenada fixa** (-29.718, -52.428); formulários vinham pré-preenchidos com ela; o mapa desenhava itens sem coordenada no centro ou em posição **aleatória**. | ✅ Coordenada vazia vira `null`; mapa só desenha o que tem coordenada |
| D6 | Resultado de ovitrampa retornava sucesso e marcava "Resultado disponível" sem coleta associada ou com falha de gravação. | ✅ |
| D7 | Bloqueio epidemiológico criado com `neighborhood_id` falso e exibido como criado mesmo se a gravação falhasse. | ✅ Exige bairro real; erro exibido |
| D8 | Denúncia interna exibia protocolo mesmo quando a gravação falhava. | ✅ |
| D9 | QR não reconhecido abria vistoria do **primeiro imóvel da lista**; "Baixar área offline" era um `setTimeout` que anunciava sucesso. | ✅ |
| D10 | Troca entre rotas do mesmo hub (ex.: Equipes → Produtividade) não trocava a aba. | ✅ `useHubTab` + cada aba com URL própria |
| D11 | URLs canônicas do catálogo (`/mapa`, `/territorio`, `/visitas`, `/equipes`…) não resolviam e caíam na Sala de Situação; mapeamento duplicado em dois `if/else`. | ✅ `routes.ts` |

### 2.3 Dados fabricados apresentados como reais (todos ✅ salvo indicação)

| Tela / serviço | O que era exibido |
|---|---|
| Sala de Situação (`situationRoomService`, `DashboardView`) | mínimo de 4 equipes e 24 agentes, 18 focos eliminados, 100 imóveis por bairro sem cadastro, densidade de ovos 45 e "14 dias sem visita" fixos no motor de risco, ciclo "1º Ciclo 2026", bairro prioritário "Centro" fixo, barras de 5% com zero criadouros, pendências de todos os municípios |
| Alertas (`alertsService`) | alertas **críticos fictícios** (ex.: caso confirmado em gestante) quando não havia alertas, exigindo "ciência obrigatória" |
| Epidemiologia | casos SINAN fictícios, **população fixa de 128.500 hab.** na taxa de incidência, banner "tendência acentuada no bairro Vila Nova", bloqueios com bairro/raio/equipe inventados |
| Produtividade | lista fixa de 4 agentes com métricas por fórmula, diagnóstico de microáreas fixo, "100% dos focos eliminados", registro de apoio que não gravava nada |
| Equipes / carga operacional | 6 equipes fictícias; 3 agentes fictícios; supervisor sempre "Não designado" (coluna errada) |
| Supervisão | agentes inventados com telefone, status "offline" pelo índice da lista, mínimos de visitas/pendências, "alertas prioritários" fixos |
| Motor de Risco | risco por bairro calculado com entradas fixas (1 ovitrampa positiva, 40 ovos, 70% cobertura…) — agora usa as entradas reais da Sala de Situação |
| Ciclos | progresso fixo (71,4%, 1.998 visitados, 24 focos) — agora calculado das visitas |
| Relatórios | "pendências" = 8% dos imóveis, **hash SHA-256 de autenticidade fixo**, exportação XLSX que só exibia "sucesso"; todos os tipos de relatório mostravam a mesma tabela (agora há aviso) |
| Documentos | município "Santa Cruz do Sul", pessoas, endereço e laudo "Positivo para vetor" pré-preenchidos |
| Portal do Cidadão | cobertura "78%" quando faltava dado; município de exemplo fixo |
| Centro de Comando / Endemias em Números | 78% de cobertura, 14 ACE, 248 visitas, 2.418 visitas, 42 agentes, tempo de resposta 28h |
| Clima (`weatherService`) | clima **sintético rotulado como fonte "INMET"** |
| Integrações | "sincronização" sorteava registros e gravava job `sucesso` + integração `ativo` ("Padrão MS/DATASUS, deduplicação 100%") |
| Comunicação | mensagens gravadas como **"enviado"** com referência de provedor inventada, sem provedor |
| Usuários (Administração) | tela inteira sobre `localStorage`: criar, editar, desativar e "enviar redefinição de senha" não chegavam ao banco |
| Auditoria (Administração) | logs de exemplo; IP `127.0.0.1` exibido quando ausente |
| Cache local (`storage.ts`) | semeava bairros, imóveis, denúncias, alertas, usuários, logs em todo navegador; agora não semeia e limpa os exemplos gravados por versões anteriores |
| `AdministrationView` (sem menu) | "importador" que só contava linhas do CSV — removida |

---

## 3. Alterações realizadas

### 3.1 Módulos removidos

| Módulo | Arquivos removidos | Compatibilidade |
|---|---|---|
| Central TV / Telão | `OperationsRoomView.tsx`, botão do cabeçalho | `/tv`, `/tv_mode` → tela inicial do perfil |
| Briefing Diário | `DailyBriefingView.tsx`, `dailyBriefingService.ts` | `/briefing` → tela inicial |
| Assistente IA | `AiAssistantView.tsx`, `aiQueryService.ts` (respostas por palavra‑chave e texto predefinido, não era IA); permissão `ia_assistente.use` do espelho RBAC; `@google/genai` do `package.json`; capacidade Gemini do `metadata.json`; bloco Gemini do `.env.example` | `/assistente` → tela inicial |
| Capacitações e Cursos | `TrainingsView.tsx`, `trainingService.ts` | `/capacitacoes` → `/equipes` |
| Metas e Indicadores | `ManagementTargetsView.tsx`, `managementTargetsService.ts` | `/metas` → `/produtividade` |
| Código morto | `AdministrationView.tsx`, `AuditLogsView.tsx`, `TerritoryView.tsx` (importados, nunca renderizados), `seedData.ts` | `/admin` → Configurações |

Catálogo `ALL_SYSTEM_PAGES`: 58 → 53 páginas.

### 3.2 Navegação

Menu (`src/config/navigation.ts`), filtrado pela mesma regra de acesso das rotas. Para ACE e Supervisor, "Campo ACE" vem primeiro; a tela inicial do ACE é o PWA.

| Grupo | Itens (abas consolidadas) |
|---|---|
| Início | Sala de Situação |
| Campo ACE | PWA do Agente · Visitas · Minha Rota · Pendências · Planejamento · Supervisão |
| Território | Imóveis · Mapa · Bairros e Setores (abas: visão geral, bairros, setores, quadras, microáreas) · Reconhecimento Geográfico · Pontos Estratégicos · Imóveis Especiais |
| Vigilância | **Ovitrampas & Laboratório** (destaque, "Core") · Controle Vetorial (+ Operações Químicas) · LIRAa/LIA · Ciclos · Epidemiologia · Focos e Reincidências |
| Gestão Operacional | Equipes & Produtividade · Denúncias & Encaminhamentos · Estoque & Insumos · Equipamentos · Ordens de Serviço |
| Relatórios | Relatórios & Documentos |
| Administração | Usuários · Perfis e Permissões · Auditoria · Configurações · Integrações · Saúde do Sistema (+ Qualidade, Integridade, Erros) |

**Telas mantidas fora do menu** (acessíveis por URL e pela busca Ctrl+K, com permissão): Centro de Comando, Painel do Secretário, Motor de Risco, Análise Histórica, Central de Alertas, Endemias em Números; Etiquetas QR, Importação e Comunicação têm atalho em Configurações. *Decisão pendente:* manter, remover ou devolver ao menu.

Cada aba de hub tem URL própria (`/equipes` ↔ `/produtividade`, `/ovitrampas` ↔ `/laboratorio-entomologico`, `/territorio/bairros` etc.). URLs antigas no formato `/<id_da_tela>` (ex.: `/visits`, `/ace_pwa`) continuam funcionando e são trocadas pela URL canônica.

### 3.3 Arquivos principais

**Novos**

| Arquivo | Função |
|---|---|
| `src/config/routes.ts` | Mapa central URL ↔ tela, aliases, redirecionamentos legados, permissões, `canAccessRoute` (fail-closed), tela inicial por perfil, abas dos hubs |
| `src/config/navigation.ts` | Grupos do menu e filtro por perfil |
| `src/config/publicMunicipality.ts` | Município do Portal do Cidadão (`?municipio=` ou `VITE_PUBLIC_MUNICIPALITY_ID`) |
| `src/services/municipalityScope.ts` | `requireMunicipalityId` / `MissingMunicipalityError` |
| `src/services/offlineVisitQueue.ts` | Fila offline do PWA sem perda/duplicidade |
| `src/services/auditLogService.ts` | Leitura paginada e gravação em `audit_logs` |
| `src/services/userAdminService.ts` | Perfis (`profiles`) e papéis (`user_roles`) do município |
| `src/hooks/useHubTab.ts` | Aba do hub sincronizada com a URL |
| `src/components/views/VectorControlHubView.tsx` | Hub Controle Vetorial + Operações Químicas |
| `src/components/public/PublicPortalUnavailable.tsx` | Aviso de portal sem município |
| `supabase/migrations/20260923000031_tenant_isolation_hardening.sql` | Migração de isolamento (proposta na rodada 1; validada e ampliada na rodada 3) |

**Reescritos ou muito alterados:** `App.tsx`, `Sidebar.tsx`, `Header.tsx`, `AuthContext.tsx` (`useMunicipalityId`, limpeza do cache no logout), `storage.ts`, `supabaseService.ts`, `situationRoomService.ts`, `agentProductivityService.ts`, `supervisorService.ts`, `teamService.ts`, `alertsService.ts`, `weatherService.ts`, `integrationService.ts`, `communicationService.ts`, `systemSettingsService.ts`, `systemAuditService.ts`, `rbac.ts`; telas `DashboardView`, `AcePwaView`, `UsersManagementView`, `AuditLogsAdminView`, `AgentProductivityView`, `EpidemiologyView`, `RiskEngineView`, `ReportsView`, `SupervisorMobileView`, `DocumentsCenterView`, `MapView`, `CyclesView`, `ReferralsView`, `CitizenPortalView`, hubs; `testSuite.ts`; `CORE_ARCHITECTURE_RULES.md` (grupo "Vigilância" e mapa de rotas, sem afrouxar as regras de Ovitrampas).

Demais telas receberam apenas a troca para o município da sessão.

### 3.4 Testes adicionados

Rotas (regra de acesso em toda rota, unicidade de URLs, abertura direta/recarga/aliases/barra final/query, rotas públicas, abas ↔ URL, catálogo auditado ↔ rotas); módulos removidos; permissões (fail-closed, ACE bloqueado em rotas administrativas por URL direta, tela inicial e ordem do menu do ACE, restrições de papel, 7 grupos); isolamento municipal (serviços rejeitam município vazio; varredura do código-fonte pelo UUID de exemplo); portal público; fila offline (duplicidade, perda durante sync, outro município, sem ciclo). Os testes de menu e rota de Ovitrampas passaram a usar a configuração real, não simulações.

---

## 4. Módulos preservados

Território, Imóveis, Visitas e **Ovitrampas** (módulos core de `coreModules.ts`, com rotas `/territorio`, `/imoveis`, `/visitas`, `/ovitrampas`, `/ovitraps`); PWA e uso offline do ACE; planejamento; rotas; pendências; ciclos; LIRAa; pontos estratégicos; imóveis especiais; controle vetorial e operações químicas; epidemiologia; focos; denúncias e encaminhamentos; equipes e produtividade; estoque e insumos; equipamentos; ordens de serviço; relatórios e documentos; autenticação (login, recuperação e redefinição de senha, primeiro acesso, simulação de perfil auditada); auditoria; Portal do Cidadão e suas rotas públicas; todas as migrações e políticas RLS (inalteradas).

---

## 5. Integrações

| Integração | Onde | Variáveis | Estado | Teste |
|---|---|---|---|---|
| Supabase (banco, Auth, RPCs) | `supabaseClient.ts` e serviços | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Funcional | Servidor respondeu (HTTP 401 para anônimo, esperado). Fluxos autenticados **não testados** (sem usuário de teste) |
| Provisionamento de contas | `scripts/*.mjs` | `SUPABASE_SERVICE_ROLE_KEY` (fora do frontend) | Scripts existentes | Não executado |
| IBGE (localidades e população) | `ibgeService.ts` | nenhuma (API pública) | **Implementada** (rodada 3) | Teste automatizado com chamada real |
| e-SUS, SINAN (API), GAL, SIVEP, CNES | `integrationService.ts` | nenhuma | **Não implementadas** (eram simuladas). A tela informa a indisponibilidade e nada é gravado. O SINAN entra por arquivo | — |
| WhatsApp/SMS | `communicationService.ts` | nenhuma | **Sem provedor** (era simulado). Envio recusado com mensagem clara | — |
| Clima | `weatherService.ts` (tabela `weather_daily`) | nenhuma | Sem provedor externo; lê só o que estiver na tabela. Sem dados → fator climático desconsiderado | — |
| Mapas | Leaflet + tiles OpenStreetMap; CSS via `unpkg.com` | nenhuma | Externo, sem chave | Não testado |
| Gemini (`@google/genai`) | — | `GEMINI_API_KEY` (só no `.env.example` antigo) | Nunca foi usada no código; removida | — |

Nenhum valor de `.env` foi exibido ou registrado; o `.env` está no `.gitignore` e contém apenas URL e chave anônima.

---

## 6. Banco de dados

Nenhuma migração existente foi apagada ou editada. A rodada 3 criou as migrações 31–35 em `supabase/migrations/` (seção 10.2).

**Objetos que ficaram sem uso na interface (mantidos, para avaliação):**

- `trainings`, `training_participants` (migration 15) — Capacitações removidas.
- `management_targets` (migration 16) — página de Metas removida.
- Permissão `ia_assistente.use` e seus vínculos em `role_permissions` (migrations 07 e 24) — Assistente IA removido.
- RPC `get_public_municipality` — não é mais chamada por nenhum código do frontend (era usada só no teste de conexão da auditoria, com o UUID de exemplo).

**Destino decidido na rodada 3:**

- As tabelas foram mantidas com os dados, marcadas como descontinuadas e ficaram sem escrita pela API (migração 35).
- `ia_assistente.use` e `get_public_municipality` também foram mantidas: são inofensivas e a remoção seria destrutiva.
- As migrações propostas nas rodadas 1 e 2 foram validadas, ampliadas e movidas para `supabase/migrations/` (seção 10).

---

## 7. Pendências que dependem de acesso externo ou decisão

Atualizado na rodada 3. O passo a passo está em `docs/RUNBOOK-HOMOLOGACAO.md`.

1. **Aplicar as migrações 31–35 no projeto Supabase**, primeiro no ambiente de homologação e depois em produção.
   - Já estão versionadas e foram validadas localmente.
   - O `db push` exige login na CLI (token) ou a senha do banco, que não estão neste ambiente.
2. **Usuários de teste por perfil:** o script `scripts/create-test-users.mjs` cria ACE, Supervisor e Admin municipal. Precisa da chave `service_role`.
   - Os fluxos de banco de cada perfil foram validados localmente: bootstrap da sessão, gravação de visita, papéis e configurações.
   - O login pela interface, que passa pelo Supabase Auth, só pode ser validado no projeto real.
3. **Vincular os ACE:** a migração 34 cria o cadastro de agente de todos os ACE ativos. Os ACE novos são vinculados pela tela de Usuários.
4. **Divulgar o link do portal:** o link está em Configurações, e `scripts/portal-links.mjs` lista os links de todos os municípios. A divulgação em si cabe à gestão municipal.
5. **Integrações que exigem contrato:**
   - e-SUS APS, SINAN (API), GAL, SIVEP e CNES: exigem convênio e credenciais;
   - WhatsApp: exige conta WhatsApp Business verificada, token e modelos aprovados;
   - o IBGE já está implementado e o SINAN entra por arquivo.
6. **Configuração de Auth:** decidir se o cadastro público (sign-up aberto hoje) continua habilitado. Com a migração 31, ele não dá acesso sem perfil pré-cadastrado.

---

## 8. Limitações conhecidas e recomendações

- **Autorização fina dentro do município:** as tabelas operacionais usam a política genérica de município (migration 26), ou seja, qualquer usuário ativo do município pode ler e gravar. As permissões finas (por exemplo, ACE sem `visitas.delete`) são aplicadas só na interface. A rodada 3 restringiu no banco as tabelas sensíveis: papéis, usuários, configurações, logs, `agents` e encaminhamentos. Estender políticas por permissão às demais tabelas é a próxima recomendação de segurança.
- **Revisão de acessibilidade e responsividade:** papéis ARIA e estados de carregamento/erro foram adicionados nas telas reescritas; uma revisão completa de teclado e telas móveis das ~50 telas não foi feita.
- **Status do catálogo de páginas** (Funcional/Parcial/Mock) continua declarado, não medido; a tela de Integridade agora avisa isso.
- **Códigos gerados no navegador** (imóvel `IMV-`, equipamento `EQP-`, fallback de ovitrampa `OVI-`) usam número aleatório e podem colidir; o ideal é gerar no banco (sequência).
- **Métricas heurísticas documentadas:** índice de carga operacional (Equipes) e nível de risco por focos (Centro de Comando, sinais da Análise Histórica) são fórmulas simples sobre dados reais, descritas no código; não são modelos validados epidemiologicamente.
- Os arquivos alterados ficaram com final de linha LF; o Git normaliza para CRLF no checkout (aviso `LF will be replaced by CRLF`, sem efeito no conteúdo).

---

## 9. Rodada 2 — pendências executadas

Base: commit `df30647`. Sem commit, push, deploy ou alteração no banco.

### 9.1 Tipagem e dependências

- Instalados `@types/react` e `@types/react-dom`; ativado `strictNullChecks` no `tsconfig.json`; adicionado `src/vite-env.d.ts`.
- Removidas as dependências sem uso `express`, `@types/express` e `motion` (confirmado com `rg` em todo o repositório).
- A tipagem completa revelou bugs reais, corrigidos:
  - **Editar um imóvel apagava setor e quadra** (o formulário descartava esses campos e o serviço gravava `null`).
  - **Equipamentos** era renderizado sem município e teria as consultas bloqueadas.
  - **Operações químicas** criavam registros sem `municipality_id` (gravação falharia).
  - Telas que recebiam `municipalityId` opcional passaram a exigi-lo.

### 9.2 Telas auditadas nesta rodada (dados fabricados removidos)

| Tela / serviço | O que era fabricado | Agora |
|---|---|---|
| Análise Histórica (`historicalAnalysisService`) | **Séries inteiras geradas por fórmula** (ex.: "2026 com redução de 12% pelas intervenções") | Séries reais por mês, ciclo ou semana (focos, casos, cobertura, produtividade, ovos, inspeções de PE, denúncias atendidas); IIP/IB/reincidência declarados indisponíveis |
| Sinais preditivos (`predictiveIntelligenceService`) | Anomalias inventadas ("aumento de 65%", IPO 42%→78% num "Setor Central", cluster em "Bairro Universitário"); consultava tabela inexistente | Sinais comparando 30 dias × 30 anteriores, com critérios documentados e confiança por tamanho de amostra |
| Painel do Secretário | Semáforo com risco 35 sem dados, "+8% vs ontem", ciclo "1º Ciclo 2026", texto-síntese com "4 equipes" | Semáforo "sem dados" quando aplicável; comparativos reais; síntese condicionada aos dados |
| Centro de Comando | Bairros fictícios, ciclo "Ciclo 05 / 2026", mínimos inventados; consultava tabelas inexistentes | Reescrito sobre visitas, bloqueios, PEs, casos e alertas do município |
| Ordens de Serviço (geração automática) | **Criava OS reais a partir de gatilhos fictícios** ("paciente na Rua das Flores, 420") | Gatilhos reais: denúncias abertas, PEs vencidos, imóveis reincidentes, casos recentes (sem dados do paciente) |
| Supervisão (abas Planejamento e Mapa) | OS e contagens fixas; botões que só exibiam `alert` | OS abertas reais e contagens do dia, com atalhos para as telas completas |
| Epidemiologia (curva epidêmica) | Tabela fixa de 8 semanas "2025 × 2026" | Casos por semana epidemiológica, ano atual × anterior |
| Equipes (carga operacional) | Equipe fixa, focos `|| 6`, cobertura 75%, carga-base 30% | Contagens reais por agente; índice documentado sem valor-base |
| Saúde do Sistema | Backup "hoje às 03:00", sincronização "há 4 min", versão "v2.4.0-SUS", varredura de integridade que sempre dizia "100% íntegro" | Apenas medições reais; varredura por contagens no banco; backup declarado como não visível pelo sistema |
| Tendências de ovitrampas | Série fixa quando vazia; consulta **sem filtro de município** | Filtrada pelo município, sem série inventada |
| Qualidade de Dados | Nota 88 e problema fictício em caso de erro | Mensagem de erro, sem nota |
| Configurações › Geral | Nome, IBGE, CNES, e-mail e telefone de outro município como padrão | Campos vazios; nome/IBGE/UF vêm do banco |
| Mapa | Centro fixo em uma cidade | Sem centro configurado, abre no Brasil e enquadra os pontos reais |
| Minha Conta, LIRAa, Ovitrampas, Transparência, Portal | Nome, e-mail, IBGE, anos e ciclos fixos | Dados da sessão ou do ano corrente |
| Login | "Plataforma homologada pelo Ministério da Saúde" (sem evidência) | Texto neutro |
| Focos (notificação sanitária) | Protocolo fixo "NOT-2026-089"; auditoria gravada só no navegador | Mensagem real; gravação em `audit_logs` com o usuário |
| Configurações (salvar) | Auditoria gravada só no navegador | Gravação em `audit_logs` |

### 9.3 Funcionalidades adicionadas para destravar pendências

- **Vínculo de agente** na gestão de usuários (`userAdminService.linkAgent`), com registro na auditoria.
- **Link oficial do Portal do Cidadão** em Configurações.
- **Encaminhamentos** usam a tabela do banco quando existir (`referralService`), com aviso visível em modo local — o aviso citado na rodada 1 não existia na tela e foi adicionado.
- **Carregamento por rota** (`React.lazy`) e pacotes separados para React, Supabase e ícones: pacote inicial de ~1,7 MB para 376 kB.
- **Cache local enxuto** (`storage.ts`): de ~50 métodos (vários com dados e textos fixos) para os 15 usados, somente leitura, hidratados do município da sessão.

### 9.4 Testes adicionados (46 no total)

Séries históricas indisponíveis sem fonte; janelas de comparação contíguas e sem sobreposição; cache local sem dados de exemplo; varredura do código-fonte contra valores de demonstração conhecidos (coordenadas, pessoas, município, ciclos, população, hash e protocolos fixos). O teste de auditoria que dizia verificar "persistência" foi renomeado para o que de fato verifica.

### 9.5 Validação

`npm run lint` sem erros; `npm test` 46/46; `npm run build` concluído sem aviso de tamanho; renderização headless do build confirmou login, portal (com e sem `?municipio=`), consulta de protocolo e bloqueio de rota interna sem sessão. Fluxos autenticados continuam sem teste em runtime (sem credenciais).

---

## 10. Rodada 3 — homologação do banco, esquema real e decisões

Sem acesso ao projeto Supabase (sem token da CLI, sem senha do banco e com o Docker indisponível porque o serviço WSL está desativado), a homologação foi feita num **PostgreSQL 15 local** com a linha de base de um projeto Supabase (`scripts/homologacao/`):

- papéis `anon`, `authenticated`, `service_role` e `supabase_auth_admin`;
- `auth.users` com as funções `auth.uid()` e `auth.jwt()`;
- extensões no esquema `extensions`;
- privilégios padrão do esquema `public`.

As 30 migrações existentes aplicaram sem erro, e a instalação limpa com as 35 também.

A fidelidade ao projeto real foi conferida de duas formas:

- cada divergência de coluna encontrada localmente foi confirmada no projeto real por sondagens **somente leitura** (`GET`, `limit=0`, chave anônima, nenhum dado lido);
- as configurações públicas de Auth mostram cadastro aberto (`disable_signup: false`).

### 10.1 Achados comprovados no banco (antes → depois)

Cada caso roda como o usuário indicado, simulando o PostgREST com JWT e `SET ROLE authenticated`, e termina com `ROLLBACK`.

| ID | O que um usuário conseguia fazer | Antes | Depois |
|---|---|---|---|
| S1 | Admin municipal de A lia e alterava imóveis e lia nome/telefone de denunciantes do município B | Funcionava | Bloqueado |
| S2 | Coordenador se promovia a MUNICIPAL_ADMIN; admin de A atribuía papéis a usuários de B, se dava SUPER_ADMIN e removia o admin de B | Funcionava | Bloqueado |
| S3 | ACE de A gravava visita no município B pela RPC (informando o município, ou só o imóvel de B) | Funcionava | Bloqueado (`forbidden`) |
| S4 | Coordenador renomeava papéis e virava **SUPER_ADMIN**; admin de A apagava o papel ACE de **todos** os municípios | Funcionava | Bloqueado |
| S5 | Admin de A movia o próprio perfil para B e passava a ver os dados de B | Funcionava | Bloqueado (o ACE já era bloqueado) |
| S6/S7 | Admin de A alterava configurações e lia/apagava logs de erro de B | Funcionava | Bloqueado |
| S8 | Coordenador ou admin municipal alterava a matriz global de permissões (efeito em todos os municípios) | Funcionava | Somente `SUPER_ADMIN` |
| S9 | ACE registrava auditoria em nome do admin (autoria forjada) | Funcionava | Autor definido pelo servidor |
| S10 | Cadastro público criava perfil-esqueleto no município mais antigo | Criava | Não cria (sem perfil pré-cadastrado, sem acesso) |
| A1 | ACE criava cadastro de agente | Funcionava | Exige `agentes.manage` |
| P1 | **Portal do Cidadão não gravava nenhuma denúncia** (`gen_random_bytes` fora do `search_path` no Supabase) | Erro 42883 | Protocolo e token gerados |

Totais: **antes**, 20 exploits funcionando e 4 falhas funcionais; **depois**, 26 exploits bloqueados e 28 regressões ok. As regressões cobrem:

- bootstrap de sessão do ACE, do supervisor e do admin;
- visita idempotente;
- gestão de papéis e de usuários no próprio município;
- configurações e logs do próprio município;
- simulação de perfil;
- matriz de permissões alterada pelo SUPER_ADMIN;
- encaminhamentos (criar, isolar entre municípios, sem DELETE);
- backfill de agentes;
- tabelas descontinuadas;
- portal anônimo.

### 10.2 Migrações criadas (`supabase/migrations/`)

| Arquivo | Conteúdo |
|---|---|
| `20260923000031_tenant_isolation_hardening.sql` | S1–S10: `is_platform_admin` restrito a SUPER_ADMIN; `user_roles_write`; invólucro de `submit_official_visit` (inclusive a idempotência sem revelar visitas de outro município); `roles`/`role_permissions`/`set_role_permissions` só pela plataforma; `log_impersonation` mantido para o admin municipal; `system_settings` e `system_error_logs` por município; gatilho de autoria em `audit_logs`; `handle_new_auth_user` sem perfil-esqueleto |
| `20260923000032_intersectoral_referrals.sql` | Tabela de encaminhamentos (RLS por município e permissão, sem DELETE, gatilho `updated_at`) |
| `20260923000033_public_portal_complaint_token.sql` | Token de acompanhamento com `gen_random_uuid()` (nativo), mesmo formato |
| `20260923000034_agents_link_and_write_policy.sql` | Cadastro de agente para todo ACE ativo (idempotente) e escrita em `agents` com `agentes.manage` |
| `20260923000035_deprecate_unused_tables.sql` | `trainings`, `training_participants` e `management_targets` descontinuadas: comentário e escrita revogada; dados mantidos |

### 10.3 Frontend contra o esquema real

Todas as consultas do frontend foram conferidas contra o esquema e sondadas no projeto real: 238 leituras e 124 escritas com objeto literal.

**42 leituras falhavam em produção** com erro de esquema (coluna ou relacionamento inexistente). As telas ficavam vazias sem aviso. Foram corrigidas todas, inclusive consultas escritas nas rodadas 1 e 2 sem acesso ao esquema. Destaques:

- **Listas de Ordens de Serviço, Visitas, Pontos Estratégicos e Imóveis Especiais:** `agents` não tem coluna de nome (vem de `profiles`), e PE/IE não têm endereço nem bairro próprios (vêm do imóvel).
- **Sala de Situação, Mapa, gatilhos de OS, sinais preditivos e Focos e Reincidências:**
  - usavam colunas inexistentes (`recurrence_count`, `foci_count`, `last_inspection_at`) e as tabelas inexistentes `epidemiological_blocks` e `property_visits`;
  - a reincidência passou a ser calculada a partir de `breeding_sites`, a tabela que a RPC de visita grava;
  - o vencimento de PE passou a usar `next_inspection` e a frequência cadastrada.
- **Grafias de situação divergentes:** a RPC grava `'pendente'`, `'ativo'` e `'eliminado'`, mas as telas filtravam `'PENDENTE'`, `'ABERTA'` e `'ATIVO'`. Os contadores de pendências e de focos ativos eram sempre zero.
- **Linha do tempo territorial:** reescrita sobre `visits`, `breeding_sites`, `complaints` e `blockade_operations`, sem espécie, tratamento ou agente fictícios.
- **Planejamento assistido:** atribuía todos os focos ao primeiro bairro e inventava 3 focos e 2 pendências quando não havia dados. Agora conta por bairro sobre dados reais.

**Escritas quebradas:**

- 10 serviços gravavam auditoria em colunas inexistentes (`entity_name`, `details`) e sem `module`/`entity`. **Essa trilha nunca foi salva em produção:** OS, supervisão, assinaturas, etiquetas, integrações, importação epidemiológica, entomologia e rotas. Todos passaram a usar `auditLogService.log`.
- O importador de imóveis gravava em colunas inexistentes e não conferia o erro, então informava sucesso sem gravar. Agora resolve o bairro pelo nome, grava nas colunas reais e só conta o que o banco aceitou.
- Tipos de importação sem gravação implementada deixaram de ser contados como importados. A importação de bairros foi implementada.
- A laudagem entomológica gravava `has_larvae`/`egg_count` (inexistentes) e uma situação `CONFIRMADO_POSITIVO` que tiraria o criadouro dos filtros de ativos.

Resultado: 0 leituras com erro de esquema no projeto real. A única exceção é a tabela de encaminhamentos, criada pela migração 32 e usada pela tela automaticamente quando existir. As escritas também ficaram com 0 divergências.

### 10.4 Decisões de produto executadas

- **Menu:**
  - *Painel do Gestor* (ex-Painel do Secretário) e *Central de Alertas* entram em **Início**;
  - *Motor de Risco* e *Análise Histórica* entram em **Vigilância**.
- **Removidos por duplicidade, com redirecionamento:**
  - *Centro de Comando* duplicava a Sala de Situação: `/centro-comando` passa a abrir `/dashboard`;
  - *Endemias em Números* duplicava Relatórios: `/transparencia` passa a abrir `/relatorios`.
  - O catálogo auditado tem agora 51 páginas.
- **Tabelas sem uso:** mantidas e descontinuadas (migração 35).
- **Regras do banco espelhadas na interface:**
  - *Perfis e Permissões* fica somente leitura fora da plataforma, com a explicação;
  - *Usuários* não permite alterar o próprio papel e só oferece MUNICIPAL_ADMIN a quem é MUNICIPAL_ADMIN.

### 10.5 Integrações

- **IBGE:** implementado (`ibgeService.ts`), com teste automatizado de chamada real. Em *Integrações › IBGE › Sincronizar*:
  - busca nome, UF e população estimada;
  - grava em `system_settings` (`IBGE_OFICIAL`) e registra o job em `integration_jobs`;
  - a *Epidemiologia* passa a calcular a incidência pela população oficial.
- **SINAN:** importação por arquivo corrigida; usava a coluna `case_number`, que não existe, e agora usa `notification_number`.
- **Sem implementação por falta de contrato e credenciais:** e-SUS, SINAN (API), GAL, SIVEP, CNES e WhatsApp. O que cada uma exige está no runbook.

### 10.6 Validação

- **Comandos:**
  - `npm run lint`: 0 erros;
  - `npm test`: 54/54;
  - `npm run build`: concluído.
- **Homologação reproduzível:** `scripts/homologacao` (`npm run antes` / `npm run depois`).
- **Não validado aqui**, porque exige o projeto real:
  - aplicação das migrações no Supabase;
  - login pela interface (Supabase Auth);
  - envio real de denúncia pelo portal publicado.

