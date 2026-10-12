# MasterGreen — fechamento de versão

12/10/2026. App = orçamento rápido/consulta; web = edição e gestão completas.
Esta lista não autoriza execução em produção nem assinatura/build remoto.
Em 12/10/2026 Gabriel decidiu gerar pessoalmente o APK. Seguir o roteiro
`app-mobile/app-mastergreen/docs/GERAR-APK.md`; não houve geração nesta rodada.

Runtime Docker agora usa dependências de produção apenas, usuário node e /health.
O stage build conserva ferramentas administrativas; aplicar migrações por fluxo
controlado, não pelo runtime nem automaticamente no boot. Imagem Linux ainda
precisa ser construída/testada (Docker local sem daemon); runtime isolado Windows
passou. Em publicação, fixar NODE_IMAGE no digest da imagem Node22 aprovada.

## Repetir verificações locais

Web (em sistema-web): `npm run check`, `npm test`, `npm run test:integration`,
`npm run audit:integration`, `npm run audit:security`, `npm run build`.
Os testes SQL exigem explicitamente mastergreen_develop e revertem os dados.
Nunca alterar essa proteção para apontar ao banco oficial.

Mobile (app-mobile/app-mastergreen): `npm run check`, `npm test`, `npm run lint`,
`npx expo install --check` e `npx expo export --platform android --output-dir dist/android-release-audit`.

Testes de navegador recebem como argumento o diretório instalado de Playwright:

- Mobile: tests/ux-smoke.cjs, tests/offline-smoke.cjs.
- Web: tests/quotation-deep-link-smoke.cjs, tests/quick-proposal-link-smoke.cjs,
  tests/quotation-filters-smoke.cjs, tests/quick-proposal-full-editor-smoke.cjs.

## Antes do deploy (ação separada, autorizada)

- [ ] Resolver/avaliar os alertas restantes descritos na auditoria; não usar force.
- [ ] Confirmar backup recente e testar restauração num banco separado.
- [ ] Aplicar em homologação as migrações 0002, 0003, 0004 e 0005, pela ordem,
  após conferir quais já existem. Não usar db:push indiscriminadamente.
- [ ] 0005 cria web_sessions para connect-pg-simple. Sem ela o login de produção
  não terá persistência funcional; não publicar o servidor antes da migração.
- [ ] SESSION_SECRET forte e exclusivo no ambiente; MOBILE_OWNER_EMAIL com a
  conta do proprietário. Não copiar credenciais/usuários fictícios de develop.
- [ ] HTTPS da API/web acessível pelo telefone. Em proxy reverso, configurar
  TRUST_PROXY_HOPS para o número real de proxies confiáveis (por exemplo 1 somente
  se a topologia de um proxy for confirmada). Default 0 não confia em X-Forwarded-*.
- [ ] Validar cookie Secure/HttpOnly/SameSite em HTTPS e rejeição de acesso anônimo.
- [ ] Configurar MOBILE_WEB_ORIGINS apenas com origens HTTPS necessárias; não '*'.
- [ ] Rotacionar segredos expostos com atualização coordenada dos serviços.
- [ ] Restringir porta PostgreSQL e revisar logs/backups/acessos da VPS.

## APK preview e assinatura

- [ ] Confirmar acesso à conta Expo/EAS e projectId; o app novo ainda não está
  vinculado. Há um projectId no app legado, que precisa conferência da conta/assinatura.
- [ ] EXPO_PUBLIC_API_URL e EXPO_PUBLIC_WEB_URL = URLs HTTPS de homologação.
  São endereços públicos, nunca credenciais. Build recusa URLs com senha/token/localhost.
- [ ] Usar perfil preview, package com sufixo .develop, sem substituir o aplicativo em uso.
- [ ] Confirmar custos/conta antes de solicitar build EAS. Não instalar Android SDK
  local só para isso; build em nuvem é opção quando autorizada.
- [ ] Instalar o APK no Redmi sem desinstalar o aplicativo atual. Não confundir
  preview (.develop), Expo Go e atualização final do package legado.
- [ ] Para atualização final: assinatura original e versionCode maior que o instalado.
  Conferir migração de dados em cópia/instalação de teste, sem apagar o aparelho real.

## Aceite do proprietário no aparelho (evidência manual)

1. Primeiro login online; fechar e abrir sem pedir senha novamente.
2. Preencher proposta com item manual e outra usando catálogo; manter cálculo de 4,5%.
3. Modo avião: salvar, fechar app, reiniciar telefone e recuperar rascunho/fila.
4. Gerar/visualizar/compartilhar PDF curto e longo pelo WhatsApp; repetir no histórico.
5. Reconectar ao Wi-Fi: cada proposta aparece uma vez no web, com cliente/itens/valor.
6. Editar no web; no celular consultar total atualizado, distinguir cópia original e
   abrir a versão atual no navegador autenticado. Mobile continua sem editor.
7. Abrir relatório, mudar valores/custos no web e sincronizar; conferir atualização.
8. Verificar login expirado/renovação em ambiente de teste, sem perder pendências.
9. Testar Wi-Fi obrigatório e opção dados móveis; restrições de bateria Xiaomi.
10. Fontes extragrandes, contraste, teclado, TalkBack, foco de modais e navegação.
11. Desligar Metro/computador: app instalado deve abrir, calcular e gerar PDF offline.

## Critério de aprovação

Sem falhas bloqueadoras de dados, autenticação ou documentos; alertas de segurança
triados com decisão explícita; testes automatizados verdes; roteiro Android aprovado;
backup e retorno verificados. Então revisar diffs, consolidar develop nos dois repos,
criar versão e somente com autorização publicar web/migrações/APK.

Retorno: manter a versão anterior da imagem web e artefato APK/assinatura. Migrações
novas são aditivas; reverter código não exige apagar tabelas nem propostas. Android
pode impedir downgrade por versionCode: planejar nova build corrigida/maior. Nunca
orientar desinstalação para contornar sem antes preservar dados não sincronizados.
