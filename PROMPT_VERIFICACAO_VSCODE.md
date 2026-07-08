# Prompt para o Claude (VS Code) — Verificação pós-migração MasterGreen

Copie tudo abaixo da linha e cole no Claude do VS Code.

---

Você está no repositório do sistema **MasterGreen** (gestão de orçamentos de grama sintética).
O sistema foi **migrado do Replit/Neon para uma VPS Hostinger rodando EasyPanel** (Docker).
As mudanças de código já feitas: driver do banco trocado de `@neondatabase/serverless` para
`pg` (node-postgres) em `server/db.ts`; imports corrigidos em `server/index.ts`; `Dockerfile`,
`.dockerignore` e `drizzle.config.ts` ajustados; a logo do login passou a ser importada.

Você tem acesso de administrador à pasta e ao terminal. Faça as verificações abaixo e, ao final,
**entregue um relatório** dizendo o que está OK e o que precisa de correção. Trate as credenciais
como segredos (não faça commit delas). **Não altere/apague dados de produção** — testes de escrita
devem rodar SEMPRE contra um Postgres descartável local, nunca no banco da VPS.

## Dados do ambiente
- Repositório: `GabrielTrindade20/SistemaMastergreen`, branch `replit-agent`
- URL de produção: https://sistema-mastergren-web-mastergreen-app.kb5uiq.easypanel.host/
- Postgres da VPS (EasyPanel) — host interno `sistema-mastergren-web_mastergreen_db`, porta 5432,
  usuário `postgres`, banco `sistema-mastergren-web`. (A senha está nas credenciais do serviço
  Postgres no EasyPanel; para acessar de fora, habilite temporariamente o "Remote Access".)
- Banco antigo (Neon), somente leitura para comparação:
  `postgresql://neondb_owner:npg_co7I6nWEakZd@ep-delicate-glade-afhtezpi.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require`
- Usuários-semente criados automaticamente SE a tabela `users` estiver vazia:
  `admin@mastergreen.com` / `admin123`, `joao@filial1.com` / `func123`, `ana@filial2.com` / `func456`.

---

## Tarefa 1 — Git: destravar e confirmar a correção da logo
1. Se existirem, apague os locks travados: `.git/HEAD.lock` e `.git/refs/heads/replit-agent.lock`.
2. Verifique se `client/src/pages/login.tsx` contém `import logoMastergreen from "@/imagem/logoSemFundo.png";`
   e usa `src={logoMastergreen}` (não pode existir mais `src="/src/imagem/..."`).
3. Confirme se essa mudança já está commitada e no GitHub:
   `git log --oneline -5` e `git status`. Se ainda não foi enviada, faça:
   `git add client/src/pages/login.tsx && git commit -m "fix: importa a logo para producao" && git push origin replit-agent`.
   (Não use `git add -A`: o working tree tem muitos arquivos marcados como modificados só por
   causa de quebras de linha CRLF; adicione apenas os arquivos que realmente mudaram.)
4. Depois do redeploy no EasyPanel, confirme que a logo aparece na tela de login em produção
   (abra a URL, ou verifique que o bundle em `dist/public/assets` referencia `logoSemFundo`).

## Tarefa 2 — Build limpo (reprodutível)
1. Rode `npm ci` e depois `npm run build`. Ambos devem terminar sem erro.
   (`npm ci` exige `package.json` e `package-lock.json` em sincronia — se falhar, rode
   `npm install`, valide `npm ci --dry-run`, e commite o `package-lock.json` atualizado.)
2. Confirme que gerou `dist/index.js` e `dist/public/index.html` + `dist/public/assets/`.

## Tarefa 3 — Confirmar a migração dos dados (produção vs Neon)
Objetivo: garantir que os dados REAIS de vocês estão na VPS, e não apenas os usuários-semente.
1. Conecte no Postgres da VPS (habilite Remote Access no EasyPanel ou rode `psql` de dentro da
   VPS via SSH) e liste as tabelas e contagens:
   `\dt` e `SELECT count(*) FROM users; SELECT count(*) FROM customers; SELECT count(*) FROM quotations; SELECT count(*) FROM products;`
2. Faça as mesmas contagens no Neon (read-only) e **compare**. Devem bater (fora eventuais
   diferenças esperadas).
3. Sinal de alerta: se em `users` só existir `admin@mastergreen.com` e as demais tabelas
   estiverem vazias, os dados do Neon **não foram migrados** — nesse caso rode o dump/restore:
   `pg_dump "<URL_NEON>" --no-owner --no-acl -f backup.sql` e depois
   `psql "<URL_POSTGRES_VPS>" -f backup.sql` (num banco vazio).
4. Ao terminar, **desabilite o Remote Access** do Postgres no EasyPanel.

## Tarefa 4 — Teste funcional ponta a ponta (Postgres descartável local)
Não teste escrita na produção. Suba um Postgres local e exercite a API:
1. `docker run --name mg-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=mastergreen -p 5433:5432 -d postgres:16`
2. Crie o schema: `DATABASE_URL="postgres://postgres:test@localhost:5433/mastergreen" PGSSL=false npm run db:push`
3. Suba o app: `DATABASE_URL="postgres://postgres:test@localhost:5433/mastergreen" PGSSL=false NODE_ENV=production PORT=5099 node dist/index.js`
   (no boot ele cria produtos e usuários padrão).
4. Com `curl`, exercite os fluxos principais e verifique status 2xx e JSON coerente:
   - Login: `POST /api/login` com `{"email":"admin@mastergreen.com","password":"admin123"}`
     (guarde o cookie de sessão com `curl -c cookies.txt`; use `-b cookies.txt` nas próximas).
   - `GET /api/me`, `GET /api/products`, `GET /api/customers`, `GET /api/users`.
   - Criar cliente: `POST /api/customers`.
   - Criar orçamento: `POST /api/quotations` (com itens) e depois `GET /api/quotations/:id` —
     confira se os cálculos financeiros (subtotal, NF 5%, lucro, dízimo 10%, total) vêm corretos.
   - Aprovar: `PUT /api/quotations/:id/status`.
   - Dashboard: `GET /api/dashboard`.
   - Relatório/PDF: `GET /api/extract/pdf` (ou o formato aceito) — confirme que responde sem erro.
5. Ao terminar: `docker rm -f mg-test`.

## Tarefa 5 — Revisar riscos conhecidos (herdados do template)
Aponte no relatório se estes pontos existem e sugira correção (não precisa corrigir agora):
1. `server/index.ts`: o middleware de erro faz `throw err` depois de responder — isso pode
   derrubar o processo (uncaughtException) quando qualquer rota lançar erro. Recomende remover o
   `throw err`.
2. Sessões usam `MemoryStore` (aviso nos logs) — some a cada restart/deploy, deslogando usuários.
   Recomende trocar por `connect-pg-simple` (já está nas dependências) usando o mesmo Postgres.
3. Senhas de usuários estão em texto puro no banco. Recomende migrar para hash (bcrypt).
4. Confirme que a porta do proxy no EasyPanel é 5000 e que `SESSION_SECRET` é uma chave aleatória
   real (não o texto de exemplo).

## Tarefa 6 — Logs de produção
Puxe os logs do serviço App no EasyPanel e verifique se há erros recorrentes além do aviso do
MemoryStore. Reporte qualquer stack trace.

---

## Entregável
Um relatório curto com: (a) status de cada tarefa (OK / precisa ação), (b) resultado da comparação
de contagens produção vs Neon, (c) resultados dos testes de API (quais passaram/falharam),
(d) lista priorizada de correções recomendadas. Não faça commit de segredos.
