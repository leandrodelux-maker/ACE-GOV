# Design brief — MVP institucional Endemias Gov

## Público

Agentes de combate às endemias, supervisores, coordenação municipal, administração e gestores da Secretaria Municipal de Saúde.

## Trabalho principal

Transformar registros de campo em uma rotina municipal clara: planejar, visitar, registrar, sincronizar, acompanhar pendências e tomar decisões territoriais.

## Princípios

- O trabalho de hoje aparece antes da configuração do sistema.
- Nenhum dado ausente é substituído por informação inventada.
- Cada perfil vê somente as ferramentas necessárias para sua rotina.
- Risco usa cor; decoração não compete com alertas.
- Texto e alvos de toque devem continuar legíveis em aparelhos de campo.
- Recursos não homologados permanecem fora da navegação principal.

## Sistema visual

- Azul-petróleo `#0B4F6C`: identidade institucional e ações primárias.
- Verde-vigilância `#147D64`: conclusão, atividade de campo e estado positivo.
- Fundo `#F4F7F9`: área de trabalho neutra.
- Branco `#FFFFFF`: superfícies e formulários.
- Vermelho `#B42318`: risco e falha, nunca decoração.
- Tipografia: Plus Jakarta Sans para interface; JetBrains Mono apenas para códigos, protocolos e coordenadas.
- Cantos moderados de 8–12 px, bordas discretas e sombras reservadas a menus suspensos.

## Layout

```text
┌──────────────────────────────── cabeçalho municipal ────────────────────────────────┐
│ navegação │ título, filtros e ações                                                  │
│ por perfil│ indicadores principais                                                   │
│           │ situação territorial                         prioridades do dia           │
│           │ conteúdo do módulo                                                        │
└───────────┴───────────────────────────────────────────────────────────────────────────┘
```

O conteúdo é alinhado à esquerda, com no máximo 1.440 px. A hierarquia usa espaço, título e divisores; não usa badges e caixa alta como decoração.

