# Walkthrough: Transformação do Módulo Ovitrampas em Core Module do Endemias GOV

O módulo **OVITRAMPAS** foi transformado em um dos **módulos centrais e mais completos do Endemias GOV**, operando como ferramenta de **vigilância entomológica territorial, operacional e preditiva** em consonância com as diretrizes do Ministério da Saúde.

---

## 1. O que foi Implementado

### 1.1 Central de Ovitrampas (`/ovitrampas`) com 11 Abas
- **VISÃO GERAL**: Painel completo com **15 cards de KPIs calculados em tempo real pelo backend**, gráfico de curva epidemiológica de postura de ovos, blocos preditivos *"O que fazer hoje?"* e *"O que fazer amanhã?"*.
- **REDE**: Planejamento territorial da rede sentinela, detecção de áreas sem monitoramento/baixa cobertura/concentração excessiva, botão de planejamento e motor de sugestão automatizada de novos pontos com aprovação do coordenador.
- **AGENDA**: Categorias operacionais (*Hoje, Amanhã, Próximos 7 Dias, Vencidas, Sem Programação*), priorização automática (*Normal, Atenção, Alta, Crítica*), multi-seleção de armadilhas e geração de **Rota de Coleta Otimizada** despachável para o PWA do ACE.
- **INSTALAÇÕES**: Histórico e novas instalações, controle de palhetas, validação contra duplicidade ativa em campo e justificativa para substituição forçada.
- **COLETAS**: Registro de coletas com situação da armadilha (*coleta realizada, ausente, danificada, palheta perdida, acesso impossibilitado, outro*), coordenadas GPS e integridade da palheta.
- **RESULTADOS**: Painel laboratorial com **campo numérico grande** para digitação rápida da contagem de ovos, responsável pela leitura, classificação automática (*Positiva, Negativa, Inválida*) e suporte a **Dupla Conferência** com alerta de divergência excessiva (*NECESSITA REVISÃO*).
- **MAPA**: Mapa interativo multimodal georreferenciado com camadas (*Rede ativa, Instaladas, Vencidas, Positivas, Negativas, Risco territorial*), legendas e modo **Mapa de Calor (Heatmap)** agregando postura temporal.
- **INTELIGÊNCIA**: 4 grandes cruzamentos territoriais:
  1. *Ovitrampas × Focos Residenciais*
  2. *Ovitrampas × Casos Epidemiológicos Agregados*
  3. *Ovitrampas × Cobertura de Campo*
  4. *Ovitrampas × LIRAa (IPO e IDO lado a lado com IIP e IB)*
  - Detecção de **Positividade Persistente** ($\ge 2$ ciclos consecutivos) e ranking de armadilhas prioritárias.
- **HISTÓRICO**: Timeline completa do ciclo de vida de cada ponto sentinela e comparador de até 5 ovitrampas.
- **RELATÓRIOS**: Emissão de Relatório Operacional e **Boletim Técnico de Vigilância por Ovitrampas** padrão Ministério da Saúde, além de exportação em CSV/Excel e suporte a impressão executiva.
- **CONFIGURAÇÕES**: Painel administrativo municipal para intervalos de coleta (padrão 5 dias), periodicidade da rede (28 dias), gatilhos de alerta de densidade de ovos, sensibilidade de tendência e regras metodológicas.

---

### 1.2 Banco de Dados e Migration 21 Aplicada
- **Migration `20260907000021_ovitrap_advanced_intelligence_core.sql`** aplicada com sucesso via Supabase MCP no projeto ativo `aelgnzoevqupstjvsflp`:
  - `ovitraps`: adição de `name`, `street`, `number`, `reference`, `responsible_name`, `responsible_phone`, `assigned_agent_id`, `team_id`, `installation_frequency_days`, `collection_interval_days`, `active`.
  - `ovitrap_installations`: `status`, `gps_accuracy`.
  - `ovitrap_collections`: `ovitrap_id`, `collection_status`, `gps_accuracy`.
  - `ovitrap_results`: `ovitrap_id`, `reading_date`, `read_by`, `result_status`.
  - `ovitrap_settings`: tabela criada com RLS e configurações municipais.
  - Índices de alta performance criados para consultas em tempo real.

---

### 1.3 Cálculos Matemáticos Centrais Oficiais
- **IPO (Índice de Positividade de Ovitrampas)**:
  $$\text{IPO} = \left(\frac{\text{Ovitrampas Positivas}}{\text{Ovitrampas Válidas Examinadas}}\right) \times 100$$
  Implementado na função central `calculateOvitrapPositivityIndex`, descartando inválidas e prevenindo divisão por zero.
- **IDO (Índice de Densidade de Ovos)**:
  $$\text{IDO} = \frac{\text{Total de Ovos Contados}}{\text{Ovitrampas Positivas}}$$
  Implementado na função central `calculateEggDensityIndex`.

---

## 2. Testes Automatizados e Barreira de Release

Todos os testes unitários, de integração, E2E e de regressão foram executados com **100% de aprovação**:

| Teste | Status | Descrição |
| :--- | :---: | :--- |
| **Cálculo IPO & IDO** | ✅ PASS | Fórmulas oficiais do Ministério da Saúde com validação de denominador |
| **Cenário 47 (Ponta a Ponta)** | ✅ PASS | Fluxo do OVI-0021 (criação $\rightarrow$ instalação $\rightarrow$ coleta $\rightarrow$ 120 ovos $\rightarrow$ IPO/IDO $\rightarrow$ alerta operacional) |
| **Cenário 48 (Tendência)** | ✅ PASS | Série temporal 32 $\rightarrow$ 51 $\rightarrow$ 89 $\rightarrow$ 137 ovos identificando alta de 328% |
| **Cenário 49 (Cobertura)** | ✅ PASS | Identificação do Setor 03 como *Sem Monitoramento* e proposta de expansão |
| **RBAC e Permissões** | ✅ PASS | Todas as 9 permissões de ovitrampas validadas para Admin, Coordenador, Supervisor e ACE |
| **Barreira de Build** | ✅ PASS | `npm run build` executando `test` e compilando com zero erros |

---

## 3. Conclusão
O módulo Ovitrampas está consolidado, blindado como **CORE MODULE**, documentado nas regras de arquitetura e pronto para a rotina diária das coordenações de endemias e agentes de campo.
