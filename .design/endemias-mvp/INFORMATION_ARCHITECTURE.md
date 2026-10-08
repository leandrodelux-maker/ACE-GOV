# Arquitetura da informação — MVP institucional

## Mapa do sistema

- Início
  - Sala de Situação `/dashboard`
  - Painel do Gestor `/secretario`
  - Alertas `/alertas`
- Campo
  - Trabalho de campo `/ace-pwa`
  - Minha rota `/rotas`
  - Visitas `/visitas`
  - Pendências `/operacional/pendencias`
  - Planejamento `/planejamento`
  - Supervisão `/supervisor`
  - Demandas do cidadão `/denuncias`
- Território
  - Imóveis `/imoveis`
  - Bairros e setores `/territorio`
  - Mapa `/mapa`
  - Reconhecimento geográfico `/territorio/rg`
- Vigilância
  - Ovitrampas e laboratório `/ovitrampas`
  - Controle vetorial `/controle-vetorial`
  - LIRAa `/liraa`
  - Epidemiologia `/epidemiologia`
- Resultados
  - Relatórios `/relatorios`
- Administração, fora da navegação operacional
  - Usuários `/admin/usuarios`
  - Configurações `/admin/configuracoes`
  - Auditoria `/admin/auditoria`

As demais rotas permanecem disponíveis para compatibilidade, mas não fazem parte da navegação do MVP até homologação.

## Modelo de navegação

- Navegação primária: cinco grupos, filtrados por permissão e ordenados para o perfil.
- Navegação secundária: abas dentro de Território, Ovitrampas e Relatórios.
- Utilitários: conta, usuários, configurações e auditoria.
- Celular: menu lateral com alvos de toque de pelo menos 44 px; o perfil ACE abre diretamente no trabalho de campo.

## Prioridade de conteúdo

### Sala de Situação

1. Visitas, cobertura, pendências, focos e IPO.
2. Prioridades que exigem ação hoje.
3. Situação comparável por bairro.
4. Acesso ao mapa e relatórios.

### Trabalho de campo

1. Rota atribuída ao agente autenticado.
2. Registro de visita e ovitrampa.
3. Itens aguardando sincronização.
4. Histórico secundário.

### Administração

1. Usuários e vínculos.
2. Configuração municipal.
3. Auditoria.
4. Diagnósticos técnicos somente para a plataforma.

## Fluxos críticos

### Executar visita

1. ACE entra e abre sua rota.
2. Seleciona um imóvel atribuído.
3. Registra situação, depósitos, conduta e localização.
4. Com internet, envia ao banco; sem internet, guarda na fila do aparelho.
5. O sistema confirma envio ou informa como corrigir a pendência.

### Priorizar território

1. Coordenação abre a Sala de Situação.
2. Filtra período e bairro.
3. Compara cobertura, pendências, focos e ovitrampas.
4. Abre a atividade prioritária ou o mapa.

## Vocabulário

| Conceito | Nome na interface |
|---|---|
| Aplicativo do agente | Trabalho de campo |
| PWA | Aplicativo, apenas em instruções de instalação |
| Ticket cidadão | Demanda do cidadão |
| Engine/score | Risco territorial |
| Submit | Salvar ou enviar |
| CRUD | Não expor ao usuário |

## Crescimento

Listas operacionais usam paginação e filtros na URL em uma evolução posterior. Integrações, comunicação, estoque, equipamentos, documentos e análises avançadas só retornam ao menu após fonte de dados, responsável, permissão, teste e procedimento de suporte definidos.

