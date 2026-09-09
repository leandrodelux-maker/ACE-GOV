# REGRAS DE DESENVOLVIMENTO E ARQUITETURA CORE DO ENDEMIAS GOV

> **DIRETRIZ INEGOCIÁVEL**:
> O módulo **OVITRAMPAS (Vigilância Entomológica de Ovos)** é classificado como **FUNCIONALIDADE CORE** do sistema, assim como Território, Imóveis e Visitas Domiciliares.

---

## 1. Módulos Core Essenciais (`CORE_MODULES`)
Definidos em [`src/config/coreModules.ts`](file:///d:/GITHUB/ACE-GOV/ACE-GOV/src/config/coreModules.ts):
- `territory` (Território Municipal)
- `properties` (Cadastro de Imóveis)
- `visits` (Visitas Domiciliares)
- **`ovitraps` (Vigilância Entomológica de Ovitrampas)**

O módulo Ovitrampas **NÃO DEVE**:
- Depender de feature flags experimentais;
- Ser movido para abas ocultas ou submenus secundários;
- Ter suas rotas (`/ovitrampas`, `/ovitraps`) desativadas;
- Ter suas tabelas ou campos do banco modificados sem migrations versionadas e testes de integridade.

---

## 2. Regras de Refatoração e Preservação
Nenhuma refatoração futura nos seguintes subsistemas pode remover ou degradar a integração com Ovitrampas sem substituição explícita:
1. **Menu Principal (`Sidebar.tsx`)**: O item **Ovitrampas (Ovos)** deve permanecer acessível na seção **VIGILÂNCIA & INTELIGÊNCIA** para todos os papéis autorizados;
2. **Rotas da Aplicação (`App.tsx`)**: A rota `/ovitrampas` deve ser resolvida diretamente para `OvitrapsView`;
3. **Controle de Acesso RBAC (`rbac.ts`)**: Os papéis `SUPER_ADMIN`, `MUNICIPAL_ADMIN`, `ENDEMIAS_COORDINATOR`, `FIELD_SUPERVISOR`, `ACE`, `EPIDEMIOLOGY_AGENT` e `HEALTH_SECRETARY` devem manter suas permissões de visualização e operação da rede de ovitrampas;
4. **PWA do Agente em Campo (`AcePwaView.tsx`)**: A aba de Ovitrampas deve permitir ao ACE consultar suas armadilhas, instalar e registrar coletas com funcionamento online e offline;
5. **Sala de Situação (`DashboardView.tsx`)**: Deve manter os cards e o bloco **SITUAÇÃO DAS OVITRAMPAS** integrados aos dados reais;
6. **Banco de Dados Supabase**: As 4 tabelas relacionais (`ovitraps`, `ovitrap_installations`, `ovitrap_collections`, `ovitrap_results`) são de retenção perpétua e protegidas contra exclusão acidental.

---

## 3. Barreira de Regressão e Validação de Release
Antes de qualquer release ou build de produção:
- O comando `npm test` é executado automaticamente antes do bundle Vite (`npm run build`);
- A suíte de testes de integridade e regressão de Ovitrampas deve obter **100% de aprovação**;
- Se qualquer teste crítico de Ovitrampas falhar, a compilação é imediatamente interrompida.
