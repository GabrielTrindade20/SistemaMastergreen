# MasterGreen — desenvolvimento local e primeiro contrato mobile

O sistema web e o aplicativo são repositórios Git separados, ambos na branch
`develop`. Eles se comunicam pela API HTTP; não compartilham código ou conexão
direta com PostgreSQL. Veja `openapi-mobile.yaml` para o contrato atual e
`MOBILE-IMPLEMENTATION.md` para o escopo implementado e a homologação.

## Banco isolado

O `.env` local, ignorado pelo Git, deve apontar para `mastergreen_develop`.
Esta base é separada do banco oficial, mas está na **mesma instância PostgreSQL
da VPS**. Desde 11/10/2026, contém uma amostra de dados reais para homologação;
trate-a como base com dados pessoais e financeiros, com acesso restrito. O servidor bloqueia a
inicialização em modo `development` se `DATABASE_URL` apontar para o banco
oficial `sistema-mastergren-web`.

Para preparar uma instalação nova: configure `DATABASE_URL` para uma base de
desenvolvimento, aplique o schema com `npm run db:push`, e execute
`node --env-file-if-exists=.env --import tsx scripts/create-dev-admin.ts`
apenas se a base estiver vazia. O script só cria conta na base
`mastergreen_develop`, gera senha aleatória e a mostra uma única vez. Guarde-a
fora do repositório. O arquivo `database_setup.sql` legado não é necessário
para essa base e contém usuários de exemplo com senhas conhecidas.

Antes de rodar `db:push`, confirme sempre a base alvo; não execute migrações na
base oficial sem uma solicitação específica e backup.

## Execução

`npm run dev` inicia o web local na porta definida no `.env` (atualmente 5001).
O app precisa de `EXPO_PUBLIC_API_URL=http://IP_DO_PC:5001` no próprio
`.env.local` para acessar pelo celular. `localhost` no Android não é o PC.
A sessão web continua em memória por 24h. O aplicativo usa sessão própria,
armazenada no PostgreSQL e no SecureStore do Android, com validade fixa de 30 dias.
Reiniciar o servidor não encerra a sessão mobile.

Smoke test com conta local de desenvolvimento:
`node --env-file-if-exists=.env.local scripts/smoke-mobile-api.mjs`

O bootstrap anterior é legado; o app atual não lê produtos ou taxas do web.
Use `node --env-file=.env scripts/migrate-mobile-dev.mjs` para aplicar a migração
aditiva exclusivamente em mastergreen_develop. O app envia resumos por
`POST /api/mobile/proposals`; a consulta web fica em `/propostas-app`.

Os testes de ponta a ponta mantêm uma proposta explicitamente fictícia
de R$ 720 no banco de desenvolvimento, para inspeção visual. Os testes de
persistência transacional usam rollback. Além dela, há 285 clientes, 73 produtos,
18 custos e 126 propostas detalhadas (51 aprovadas, 75 pendentes), com 189 itens
e 462 custos vinculados, copiados da base oficial em 11/10/2026. O banco oficial
foi consultado em transação somente leitura; registros locais foram preservados.
As contas copiadas foram desativadas para login (e-mails inválidos e novos hashes).
Nenhum dump ou dado pessoal deve ser versionado. Para inspecionar a origem e o
destino sem exibir dados pessoais: `node --env-file=.env scripts/inspect-real-data.mjs`.
`node --env-file=.env scripts/import-real-sample.mjs` faz prévia; `--apply` aplica
de forma transacional e idempotente apenas em `mastergreen_develop`.
