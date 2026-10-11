# MasterGreen — desenvolvimento local e primeiro contrato mobile

O sistema web e o aplicativo são repositórios Git separados, ambos na branch
`develop`. Eles se comunicam pela API HTTP; não compartilham código ou conexão
direta com PostgreSQL. Veja `openapi-mobile.yaml` para o contrato inicial.

## Banco isolado

O `.env` local, ignorado pelo Git, deve apontar para `mastergreen_develop`.
Esta base é separada do banco oficial, mas está na **mesma instância PostgreSQL
da VPS**. Nenhum cliente ou proposta real foi copiado. O servidor bloqueia a
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
A sessão expira em 24 horas e, nesta fase, fica apenas em memória; após reiniciar
o servidor, é necessário entrar novamente no app e no web.

Smoke test com conta local de desenvolvimento:
`node --env-file-if-exists=.env.local scripts/smoke-mobile-api.mjs`

O bootstrap mobile é **somente leitura**: autentica o usuário, devolve produtos,
clientes autorizados e o percentual da nota fiscal. Não grava propostas.
O fluxo rápido/PDF segue offline no app. A sincronização de propostas,
histórico e relatórios será implementada em etapas posteriores.
