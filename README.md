# Endemias Gov

Sistema municipal para território, visitas domiciliares, ovitrampas e acompanhamento operacional de endemias.

## Requisitos

- Node.js 22+
- Projeto Supabase com as migrations de `supabase/migrations`
- Variáveis descritas em `.env.example`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Verificação

```bash
npm run lint
npm test
npm run build
```

`npm run lint` executa a checagem TypeScript sem emitir arquivos. A suíte atual inclui verificações de domínio e integração; use um ambiente Supabase de homologação, nunca a base de produção, para testes conectados.

## Escopo do MVP institucional

- Território e imóveis
- Visitas e trabalho de campo
- Pendências, planejamento e supervisão
- Ovitrampas e laboratório
- Sala de Situação e relatórios
- Usuários, configurações e auditoria

Módulos avançados permanecem fora da navegação principal até homologação municipal.

## Segurança e privacidade

- A chave pública do Supabase pode estar no frontend; chaves secretas e `service_role` nunca podem usar prefixo `VITE_`.
- Tokens de provedores externos devem ficar no backend ou em Edge Functions.
- O cache offline deve conter apenas os campos necessários à atividade atribuída ao agente.
- A autorização efetiva é aplicada no banco por RLS; esconder um item do menu não substitui uma política de acesso.

## Implantação

O servidor deve redirecionar rotas desconhecidas para `index.html`, servir HTTPS e configurar cabeçalhos de segurança. O arquivo `public/.htaccess` atende hospedagens Apache; outras plataformas precisam de regra equivalente.

Consulte [RUNBOOK-HOMOLOGACAO.md](docs/RUNBOOK-HOMOLOGACAO.md) antes de publicar migrations ou apontar o frontend para um projeto Supabase.

