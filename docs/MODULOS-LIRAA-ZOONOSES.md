# Módulos LIRAa/LIA e Vacinação Antirrábica — regras de negócio e entrega

**Branch:** `feat/liraa-lia-vacinacao-antirrabica` · **Data:** 08/10/2026 · **Migrações:** 37, 38 e 39 (não aplicadas em produção)

## 1. Diagnóstico que orientou a implementação

| Item | Situação encontrada | Decisão |
|---|---|---|
| Território | Bairros → setores → quadras → imóveis; pontos estratégicos ligados ao imóvel | Reaproveitado. O universo amostral sai do cadastro, sem cadastro paralelo |
| LIRAa existente | 3 tabelas e 1 tela; sorteio com `Math.random`; `liraa_samples` sem município; sem inspeção por depósito, laboratório ou trava | Tabelas estendidas (sem apagar). A tela antiga (`LiraaView.tsx`) foi mantida no repositório e saiu das rotas, porque o sorteio dela não é auditável |
| Laboratório | `entomological_samples` + `EntomologyLabView` | Os tubitos do LIRAa são amostras dessa tabela (`liraa_inspection_id`) |
| Depósitos | `deposit_categories` (A1–E) | Reaproveitado |
| Estoque | `products` / `product_batches` / `stock_movements` | Reaproveitado para vacinas (`category = 'vacina_antirrabica'`). **A trigger de estoque falhava em toda movimentação** (coluna `products.current_stock` inexistente) e não travava o lote; foi corrigida na migração 39 |
| Permissões | `permissions` / `role_permissions` + `has_permission()`; espelho em `rbac.ts` | Novas permissões e 3 papéis (migração 37) |
| Offline | Fila de visitas sem perda/duplicidade; **o logout apagava a fila** | Fila genérica para os módulos (`offlineQueue.ts`); o logout passa a preservar as filas |
| PWA | Manifesto sem service worker (sem abertura offline) | `public/sw.js`: guarda só a casca do app, nunca dados de saúde |

## 2. LIRAa / LIA

### 2.1 Metodologia (tabela `liraa_rule_sets`, versionada)

| Regra | Fonte | Situação |
|---|---|---|
| LIRAa: conglomerados (quarteirão → imóvel); `n = 450/(1+450/N)`; `B = N/A`; `Q = n/(B/passo)`; `IA = A/Q`; início casual em `[0, IA)` | Manual LIRAa MS/SVS 2013, cap. 2 | Referência oficial |
| Estrato de 8.100 a 12.000 imóveis: 20% (1 a cada 5); de 2.000 a 8.100: 50% | Manual 2013 | Referência oficial |
| Pontos estratégicos fora da amostra | Manual 2013, 4.5 | Referência oficial |
| Fechado/recusa: substituto imediatamente anterior, depois posterior | Manual 2013, 4.5 | Referência oficial (só no mesmo quarteirão) |
| LIRAa > 2.000 imóveis; LIA < 2.000 | Portaria GM/MS 3.129/2016 (RC CIT 1/2021) | Referência oficial; **exatamente 2.000 não é definido** e o sistema sinaliza |
| LIA: até 400 imóveis 100%; 401–1.500 1 a cada 3; 1.501–1.999 1 a cada 5 | Materiais estaduais (SES-RS, SES-TO) | **Pendente de validação**: o sorteio do LIA é bloqueado até a coordenação registrar a referência técnica (`liraa_confirm_rules`) |
| IIP: < 1% satisfatório; 1 a 3,9% alerta; > 3,9% risco | Diretrizes Nacionais MS 2009 | Referência oficial (valor arredondado a 1 casa) |
| IB: faixas de classificação | — | **Pendente**: o IB é exibido sem classificação |

**Interpretações a confirmar com a SES-GO.** As três abaixo são reproduzidas pelos testes:
- O manual fala em "partes inteiras" para a posição do quarteirão, mas o Quadro 1 arredonda (0,70 → 1; 17,5 → 18). O sistema segue o Quadro 1.
- O exemplo do manual usa `B = 26` e depois `25`, e `Q = 83` e depois `85`. O sistema usa `B` sem arredondamento.
- Estrato com menos de 2.000 imóveis num município LIRAa não é previsto pelo manual. O sistema recusa o sorteio com essa mensagem.

### 2.2 Sorteio auditável

- Executado no servidor (`liraa_execute_draw`), nunca no navegador.
- Número reproduzível: `u = 52 bits do SHA-256(semente|id do estrato)`. A mesma função existe em TypeScript (`seedUnit`), e o teste de integração compara as duas.
- Ficam gravados em `liraa_draws`:
  - semente;
  - regra e versão;
  - algoritmo;
  - parâmetros (N, A, n, B, passo, Q, IA, IC);
  - número de imóveis e **hash do universo** (lista ordenada de imóveis);
  - autor e data.
- Refazer o sorteio no planejamento marca o anterior como `substituido`. O histórico é preservado.
- Ordem oficial do sistema: número do quarteirão (ordem natural), depois logradouro, número, complemento e código do imóvel. Recomenda-se registrar a sequência do RG no cadastro para coincidir com o sentido horário de campo.

### 2.3 Situações e travas

`planejamento → execucao → conferencia → encerrado`. Qualquer situação aberta pode ir para `cancelado`. Só `liraa_change_status` muda a situação, e cada mudança vai para o histórico e a auditoria.

| Situação | O que é permitido |
|---|---|
| Planejamento | Estratos, equipe, confirmação de regras, sorteio, distribuição |
| Execução | Inspeções (ACE), laboratório, substituições |
| Conferência | Correções pela supervisão e laboratório |
| Encerrado | Nada. A reabertura exige `liraa.reabrir` e justificativa de pelo menos 15 caracteres, e fica auditada |

O encerramento exige que todos os tubitos tenham resultado.

### 2.4 Campo, laboratório e indicadores

- **Inspeção** (`liraa_submit_inspection`):
  - idempotente pelo `id` gerado no aparelho;
  - uma inspeção por imóvel sorteado;
  - **um tubito por depósito positivo, por tipo** (regra do manual);
  - fora de execução ou conferência, recusada.
- **Positividade** = tubito com Ae. aegypti confirmado em laboratório. A larva vista em campo é "suspeita" e aparece à parte.
- **Fórmulas:**
  - IIP = imóveis positivos / imóveis pesquisados × 100;
  - IB = recipientes positivos / imóveis pesquisados × 100;
  - ITR = positivos do tipo / total de positivos × 100.
- Com tubitos sem resultado, o índice aparece como **provisório**.
- O **cumprimento da amostra** (trabalhados/programados) é mostrado separado do índice de infestação.

## 3. Vacinação antirrábica e vigilância da raiva

| Regra | Implementação |
|---|---|
| Doses ≠ animais | Um animal tem uma dose válida por campanha (índice único). Na rotina, uma por dia. "Campanha rápida" sem cadastro conta 1 animal por registro; boletim agregado conta 1 animal por dose |
| Dupla contagem | O mesmo posto/dia não aceita registros individuais **e** boletim agregado ao mesmo tempo, nos dois sentidos |
| Cobertura | Animais vacinados / população estimada × 100. Sem estimativa **com fonte**, fica "indisponível" e os quantitativos continuam |
| Meta canina | Parametrizável por campanha. 80% é só o valor inicial (referência do MS) |
| Lote | Lote vencido não é aplicado nem distribuído; lote de outro município é recusado |
| Estoque | Saldo central (`product_batches.current_quantity` ≥ 0, com trava `FOR UPDATE`) e saldo por equipe (distribuído − aplicado − perdido − devolvido, com trava consultiva). Perdas exigem motivo; ajustes exigem permissão própria e justificativa; tudo é auditado |
| Offline | Dose registrada no aparelho entra na fila. Na sincronização, a falta de saldo recusa o envio, e o registro fica na fila como "precisa de correção", sem saldo negativo e sem perder o dado |
| Anulação | Exige justificativa, estorna a dose e mantém o registro como "anulada" |
| Carteira digital | Código `VAC-…` e QR para `/verificar-vacina`. A verificação pública mostra só data, espécie, vacina, lote e serviço, sem tutor nem endereço. **Não informa revacinação** (regra pendente) |
| Busca ativa | "Vacinado" só com dose registrada; "não vacinado" só confirmado em visita; o resto é "sem informação" |
| LGPD | Dados de tutores exigem `antirrabica.tutores_dados`. A consulta (auditor) vê animais, não tutores |
| Raiva | Classificação, resultado laboratorial, encerramento e bloqueio de foco exigem `raiva.decidir`. O histórico é automático. Não substitui a notificação oficial |
| Faixa etária | "Menor de 1 ano / 1 ano ou mais / não informada": **pendente** de layout estadual |
| Relatórios | Modelos configuráveis com ressalva "não substitui formulário oficial" até haver layout da SES-GO |

## 4. Banco de dados

| Migração | Conteúdo |
|---|---|
| `20261008000037_liraa_zoonoses_permissions.sql` | 21 permissões e 3 papéis: `LAB_TECHNICIAN`, `ZOONOSES_VACCINATOR`, `STOCK_MANAGER` |
| `20261008000038_liraa_lia_module.sql` | `liraa_rule_sets`, `liraa_draws`, `liraa_selected_blocks`, `liraa_inspections`, `liraa_inspection_deposits`, `liraa_lab_events`, `liraa_status_history`, `liraa_survey_members`; colunas novas em `liraa_surveys`, `liraa_strata`, `liraa_samples` e `entomological_samples`; RPCs `liraa_*`; RLS por município e permissão; travas |
| `20261008000039_zoonoses_rabies_vaccination.sql` | `animal_tutors`, `animals`, `vaccination_campaigns`, `vaccination_campaign_localities`, `vaccination_posts`, `animal_vaccinations`, `vaccination_aggregate_entries`, `zoo_search_tasks`, `zoo_search_attempts`, `rabies_events`, `rabies_event_updates`, `zoo_counters`; RPCs `zoo_*` e `public_verify_vaccination`; RLS; correção da trigger de estoque |

Nada foi apagado.
- Os status antigos do LIRAa são mapeados: `em_execucao` → `execucao`, `processamento` → `conferencia` e `finalizado` → `encerrado`.
- Escritas sensíveis passam só por RPC `SECURITY DEFINER`, com município e permissão conferidos no servidor.
- A exclusão física é revogada; vale a exclusão lógica ou o estado "anulado/cancelado".

**RPCs:**
- LIRAa: `liraa_execute_draw`, `liraa_confirm_rules`, `liraa_assign_samples`, `liraa_change_status`, `liraa_submit_inspection`, `liraa_lab_receive`, `liraa_lab_result`, `liraa_survey_counts` e `liraa_universe_by_neighborhood`.
- Zoonoses: `zoo_register_vaccination`, `zoo_register_aggregate`, `zoo_void_record`, `zoo_stock_operation`, `zoo_stock_balances`, `zoo_vaccination_counts`, `zoo_generate_search_tasks`, `zoo_register_search_attempt` e `public_verify_vaccination` (anônima).

## 5. Perfis

| Papel | LIRAa/LIA | Antirrábica | Raiva |
|---|---|---|---|
| Admin plataforma/municipal, Coordenador | tudo | tudo | tudo |
| Supervisor de campo | ver, coletar, supervisionar, exportar | ver, vacinar, cadastro, tutores, busca ativa, estoque, exportar | ver, registrar |
| ACE | ver, coletar | ver, vacinar, cadastro, tutores, busca ativa | — |
| Laboratório (novo) | ver, laboratório | — | — |
| Vacinação/Zoonoses (novo) | — | tudo, exceto ajuste de estoque | ver, registrar |
| Gestor de estoque (novo) | — | ver, estoque, ajuste, exportar | — |
| Vigilância epidemiológica | ver, exportar | ver, exportar | ver, registrar, decidir |
| Gestor de saúde | ver, exportar | ver, exportar | ver |
| Consulta/Auditor | ver | ver (sem tutores) | ver |

## 6. Testes executados

| Suíte | Resultado |
|---|---|
| `npm run lint` (TypeScript) | 0 erros |
| `npm test`: 57 anteriores + 16 novos (amostragem, Quadro 1 do manual, sorteio reproduzível, LIA, IIP/IB/ITR, classificação, laboratório, coberturas, busca ativa, estoque, fila offline, logout, permissões, relatórios em CSV/Excel/PDF) | **73/73** |
| `scripts/homologacao`: `npm run modulos` (PostgreSQL local, 39 migrações, dois municípios, sessões simuladas como no PostgREST) | **34/34**, incluindo sorteio SQL = TypeScript, isolamento, idempotência, duplicidade, lote vencido, concorrência na última dose, travas, LGPD e verificação pública |
| Regressão de segurança existente (`npm run antes` / `depois`, agora com 36–39) | 26 explorações bloqueadas; 28 regressões OK |
| Navegador (build + CSP de produção, login real) | Todas as telas novas renderizam sem erro e sem violação de CSP, inclusive em 390 px. Com o banco de produção ainda sem as migrações, mostram "módulo ainda não instalado" |

**Não validado:** o uso das telas com dados reais. Exige aplicar as migrações num projeto Supabase de homologação.

## 7. Publicação segura

1. **Homologação:** projeto Supabase separado (ou branch) → `npx supabase db push --dry-run` → aplicar 37–39 → `npx supabase db advisors`.
2. Criar usuários de teste por papel e percorrer:
   - LIRAa: levantamento → estratos → sorteio → execução → coleta offline → laboratório → encerramento;
   - campanha: entrada e distribuição de vacina → doses (individual, rápida, boletim) → painel → relatórios.
3. **LIA em Moiporá** (provavelmente abaixo de 2.000 imóveis): a coordenação deve registrar a referência técnica da SES-GO antes do primeiro sorteio.
4. Produção: backup → `db push` (37–39) → publicar o frontend (o `sw.js` vai junto no `dist/`).
5. Depois de publicar, atribuir os papéis novos em *Administração › Usuários*.

## 8. Pendências técnicas e normativas

- Validação pela SES-GO:
  - faixas do LIA;
  - arredondamentos do LIRAa;
  - faixas de classificação do IB;
  - modelo do boletim de campo e laboratório e dos boletins antirrábicos estaduais;
  - faixas etárias;
  - regra de revacinação.
- Fotos nas inspeções: não implementadas. Exigem bucket do Supabase Storage com política de acesso e regra de retenção (LGPD).
- Ordem do RG no imóvel: incluir campo de sequência para coincidir com o sentido de inspeção em campo.
- Reabertura de campanha encerrada: hoje só pela plataforma (sem tela).
- Integração direta com sistemas oficiais (SISPNCD, SINAN, SI-PNI): não há; os relatórios são para conferência.
