# ACE-GOV — Auditoria e Execução

**Data:** 23/09/2026 · **Branch:** `main` (alterações locais, **sem commit, push ou deploy**) · **Base:** commit `66e5e93`

Este documento registra o que foi auditado, o que foi corrigido no código e o que ainda depende de decisão ou de acesso externo (principalmente mudanças no banco Supabase).

---

## 1. Resumo

- **Removidos:** Central TV/Telão, Briefing Diário, Assistente IA, Capacitações e Cursos, página de Metas e Indicadores (telas, serviços, rotas, permissão exclusiva, catálogo auditado e dependência `@google/genai`).
- **Navegação:** menu reorganizado em 7 grupos; mapa central de rotas (`src/config/routes.ts`) usado por App, menu, hubs, busca e testes; URL como fonte única da tela (abertura direta, recarga e voltar/avançar); guarda de permissão **fail-closed** em todas as rotas internas.
- **Multimunicípio:** nenhum serviço ou tela usa mais o UUID de exemplo `00000000-0000-0000-0000-000000000001` como padrão; todos recebem o município da sessão.
- **Dados fabricados:** removidos de ~30 telas e serviços (incluindo alertas críticos fictícios, casos SINAN fictícios, agentes, equipes, integrações e envio de WhatsApp simulados). Sem dado, as telas mostram "Sem dados registrados" ou "Não foi possível carregar".
- **Banco:** nenhuma migração, tabela, política ou dado foi alterado. Três falhas de isolamento nas políticas/RPCs estão documentadas com uma **migração proposta não aplicada** (`docs/proposed-migrations/`).

### Resultado das validações

| Comando | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`) | 0 erros |
| `npm test` | **42/42** testes passando (eram 27) |
| `npm run build` | build concluído (aviso preexistente: bundle principal > 500 kB) |
| Verificação com `rg` | nenhuma referência quebrada aos módulos removidos (restam apenas redirecionamentos legados, testes e uma nota no RBAC, todos intencionais) |
| Renderização real (Chrome headless sobre `vite preview`) | `/login` renderiza; `/publico` sem município mostra aviso; `/publico?municipio=<uuid>` carrega o portal; `/visitas`, `/tv` e `/` sem sessão caem no login sem expor telas internas |

**Limites da validação:** os testes usam o `.env` local (só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`). Não havia credenciais de usuário de teste, então **nenhum fluxo autenticado foi exercitado contra o banco real** (login, gravação de visitas, PWA, telas internas). A conectividade foi confirmada apenas como "o servidor respondeu" (HTTP 401 para a chave anônima, esperado com RLS).

---

## 2. Achados priorizados

Legenda: ✅ corrigido no código · 🟡 corrigido parcialmente · ⛔ depende de mudança no banco (proposta, não aplicada) · 📝 registrado para decisão

### 2.1 Segurança e isolamento entre municípios

| ID | Gravidade | Achado | Situação |
|---|---|---|---|
| S1 | Crítica | `is_platform_admin()` retorna verdadeiro para `MUNICIPAL_ADMIN`. As políticas `is_platform_admin() OR municipality_id = current_user_municipality_id()` liberam a qualquer administrador municipal leitura e escrita em **todos os municípios**. | ⛔ Migração proposta (S1) |
| S2 | Crítica | Política `user_roles_write` só exige `usuarios.update`: permite atribuir qualquer papel, inclusive `SUPER_ADMIN`, a perfis de qualquer município. | ⛔ Migração proposta (S2). No frontend, `SUPER_ADMIN` só é atribuível por `SUPER_ADMIN` ✅ |
| S3 | Crítica | RPC `submit_official_visit` é `SECURITY DEFINER` e confia no `municipality_id`, `agent_id` e `property_id` enviados pelo navegador. | ⛔ Migração proposta (S3) |
| S4 | Alta | `role_permissions` é global; quem tem `perfis.manage` (administradores municipais) altera a matriz de papéis de todos os municípios. | ⛔ Migração proposta (restringe a `SUPER_ADMIN`); revisar `set_role_permissions` |
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
| `docs/proposed-migrations/20260923000031_tenant_isolation_hardening.sql` | Migração proposta (não aplicada) |

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
| e-SUS, SINAN, GAL, SIVEP, CNES, IBGE | `integrationService.ts` | nenhuma | **Não implementadas** (eram simuladas). Agora a tela informa indisponibilidade e nada é gravado | — |
| WhatsApp/SMS | `communicationService.ts` | nenhuma | **Sem provedor** (era simulado). Envio recusado com mensagem clara | — |
| Clima | `weatherService.ts` (tabela `weather_daily`) | nenhuma | Sem provedor externo; lê só o que estiver na tabela. Sem dados → fator climático desconsiderado | — |
| Mapas | Leaflet + tiles OpenStreetMap; CSS via `unpkg.com` | nenhuma | Externo, sem chave | Não testado |
| Gemini (`@google/genai`) | — | `GEMINI_API_KEY` (só no `.env.example` antigo) | Nunca foi usada no código; removida | — |

Nenhum valor de `.env` foi exibido ou registrado; o `.env` está no `.gitignore` e contém apenas URL e chave anônima.

---

## 6. Banco de dados

Nenhuma migração existente foi apagada ou editada; nenhuma migração foi criada em `supabase/migrations/`.

**Objetos que ficaram sem uso na interface (mantidos, para avaliação):**

- `trainings`, `training_participants` (migration 15) — Capacitações removidas.
- `management_targets` (migration 16) — página de Metas removida.
- Permissão `ia_assistente.use` e seus vínculos em `role_permissions` (migrations 07 e 24) — Assistente IA removido.
- RPC `get_public_municipality` — não é mais chamada por nenhum código do frontend (era usada só no teste de conexão da auditoria, com o UUID de exemplo).

**Migração proposta** `docs/proposed-migrations/20260923000031_tenant_isolation_hardening.sql` (S1–S4): restringe `is_platform_admin()` a `SUPER_ADMIN`, corrige `user_roles_write` e `role_permissions_write`, e envolve `submit_official_visit` numa função que valida município, imóvel, agente e ciclo. Inclui consultas de verificação. **Precisa de revisão e teste em homologação antes de ser movida para `supabase/migrations/`.**

**Sugestão aditiva futura (não escrita):** tabela `intersectoral_referrals` com `municipality_id` e RLS — hoje os encaminhamentos ficam salvos só no navegador (a tela avisa isso).

---

## 7. Pendências que dependem de acesso externo ou decisão

1. **Revisar e aplicar em homologação** a migração proposta (S1–S4) e depois em produção.
2. **Usuário de teste** por perfil (ACE, Supervisor, Admin municipal) para validar em runtime: login, PWA online/offline, gravação de visita via RPC, telas administrativas.
3. **Cadastro em `agents`** para cada ACE (`profile_id` → perfil). Sem isso, o PWA guarda as visitas no aparelho e avisa que o perfil não está vinculado a um agente.
4. **Portal do Cidadão:** publicar o link oficial com `?municipio=<uuid>` ou definir `VITE_PUBLIC_MUNICIPALITY_ID` no ambiente. Sem isso, `/publico` mostra "indisponível" (antes usava o município de exemplo).
5. **Conectores externos** (e-SUS, SINAN…) e **provedor de WhatsApp/SMS**: exigem contrato, credenciais e implementação.
6. **Decidir** o destino das telas fora do menu (seção 3.2) e dos objetos de banco sem uso (seção 6).

---

## 8. Limitações conhecidas e recomendações

- **`@types/react` não está instalado** e o `tsconfig` não usa `strict`: o `tsc` não valida props de componentes nem valores nulos. As assinaturas de serviços continuam tipadas (foi o que guiou a refatoração), mas props foram conferidas manualmente. Recomenda-se instalar `@types/react`/`@types/react-dom` e ativar `strictNullChecks` gradualmente.
- **Telas não auditadas linha a linha** para dados fabricados: Painel do Secretário, Análise Histórica (`predictiveIntelligenceService`, `historicalAnalysisService`), Laboratório Entomológico, LIRAa, Estoque, Equipamentos, Ordens de Serviço, Planejamento, Rotas, Reconhecimento Geográfico, Importação, Qualidade de Dados, Integridade do Sistema. Foram corrigidos nelas apenas o município da sessão e os substitutos numéricos encontrados na varredura.
- O catálogo de páginas da auditoria do sistema declara todas como `FUNCIONAL` por definição (não é medição), e o teste "Persistência no Banco" não verifica de fato a gravação em `system_audits` (falha silenciosa com a chave anônima).
- A tela de login afirma "Plataforma homologada pelo Ministério da Saúde"; não há evidência dessa homologação no repositório.
- Centro inicial do mapa ainda tem um padrão fixo quando o município não configurou Mapas & Camadas (é apenas a posição inicial da câmera, não dado).
- Dependências sem uso: `express`, `@types/express`, `motion` (mantidas; remover após confirmação).
- Bundle principal de ~1,7 MB: recomenda-se carregar telas por rota com `React.lazy`.
- Acessibilidade: foram adicionados papéis ARIA (abas, menu, diálogos, alertas de erro) nas telas reescritas; uma revisão completa de teclado e responsividade das ~50 telas não foi feita.
- Os arquivos alterados ficaram com final de linha LF; o Git normaliza para CRLF no checkout (aviso `LF will be replaced by CRLF`, sem efeito no conteúdo).
