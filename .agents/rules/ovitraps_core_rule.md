# REGRA PERMANENTE: OVITRAMPAS COMO FUNCIONALIDADE CORE

O módulo **OVITRAMPAS** é uma funcionalidade CORE do Endemias GOV (definida em `src/config/coreModules.ts`).

Qualquer refatoração deve obrigatoriamente:
1. Manter a rota `/ovitrampas` ativa e acessível;
2. Manter o item Ovitrampas visível no menu principal (sob Vigilância & Inteligência);
3. Preservar as permissões de `ovitraps.*` no RBAC para os papéis operacionais e gestores;
4. Preservar as tabelas `ovitraps`, `ovitrap_installations`, `ovitrap_collections` e `ovitrap_results`;
5. Manter a integração com a Sala de Situação e o PWA do ACE;
6. Rodar os testes automatizados garantindo 100% de sucesso.
