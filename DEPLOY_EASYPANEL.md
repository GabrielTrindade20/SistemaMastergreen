# Migração MasterGreen — Replit/Neon → VPS Hostinger (EasyPanel)

Objetivo: rodar **tudo na sua VPS** (147.79.82.97), sem depender do Replit nem da Neon.
Arquitetura final: dois serviços no EasyPanel, na mesma rede privada do Docker:

- **App** (Node/Express) → buildado a partir do `Dockerfile` deste repositório
- **Postgres** → banco próprio, com os dados vindos da Neon

O Traefik do EasyPanel (o mesmo que já serve o seu n8n) cuida do domínio e do HTTPS.
Não há conflito de porta com o n8n: o roteamento é por domínio.

---

## O que já foi alterado no código (não precisa mexer)

- `server/db.ts` — driver trocado de `@neondatabase/serverless` para o Postgres padrão (`pg`).
  Funciona com o Postgres do EasyPanel e ainda com Neon/Supabase (SSL automático).
- `server/index.ts` — corrigidos imports que faltavam (o servidor não subia standalone).
- `package.json` — adicionado `pg`/`@types/pg`, removido o driver da Neon.
- `Dockerfile` + `.dockerignore` — empacotamento do app.
- `.env.example` — modelo das variáveis.

Build já testado e funcionando (frontend + servidor).

---

## Passo 0 — Subir as alterações no GitHub

O EasyPanel builda a partir do seu repositório (`GabrielTrindade20/SistemaMastergreen`).
No seu computador (ou no Shell do Replit), dentro do projeto:

```bash
git add -A
git commit -m "Migração para VPS: driver pg, Dockerfile, correções de servidor"
git push origin replit-agent
```

(Estamos na branch `replit-agent`. Pode manter essa branch ou dar merge na `main` — só
lembre de apontar o EasyPanel para a branch certa no Passo 3.)

---

## Passo 1 — Criar o serviço Postgres no EasyPanel

1. Entre no EasyPanel → seu projeto (pode ser o mesmo do n8n ou um novo, ex.: `mastergreen`).
2. **+ Service → Postgres**.
3. Nome do serviço: `db` (o host interno vira algo como `mastergreen_db`).
4. Deixe criar e **anote as credenciais** que aparecem na aba do serviço:
   usuário, senha, nome do banco e a **Connection URL interna**.

A URL interna tem este formato (guarde para o Passo 3):

```
postgres://usuario:senha@mastergreen_db:5432/mastergreen
```

---

## Passo 2 — Migrar os dados da Neon para o Postgres do EasyPanel

### 2a. Abrir acesso remoto temporário ao Postgres do EasyPanel
No serviço Postgres → aba de configuração, **exponha uma porta pública** (Remote Access).
Escolha uma porta livre, ex.: `5433`. O EasyPanel reinicia o serviço e passa a mostrar
também uma **URL externa**, algo como:

```
postgres://usuario:senha@147.79.82.97:5433/mastergreen
```

> Isso é só para conseguirmos restaurar o backup de fora. No fim a gente fecha (Passo 2d).

### 2b. Rodar o dump da Neon e restaurar no EasyPanel
Rode os dois comandos abaixo **no Shell do Replit** (recomendado — o `pg_dump` já está lá
e casa com a versão da Neon) ou no seu PC (Ubuntu/Debian: `sudo apt install postgresql-client`).

Exportar da Neon (gera o arquivo `backup_mastergreen.sql`):

```bash
pg_dump "postgresql://neondb_owner:npg_co7I6nWEakZd@ep-delicate-glade-afhtezpi.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require" \
  --no-owner --no-acl \
  -f backup_mastergreen.sql
```

Importar no Postgres do EasyPanel (troque usuario/senha pela URL externa do Passo 2a):

```bash
psql "postgres://usuario:senha@147.79.82.97:5433/mastergreen" \
  -f backup_mastergreen.sql
```

> Faça a importação **uma vez** num banco vazio. Se precisar refazer, apague as tabelas antes.
> Não é preciso extensão extra: o schema usa `gen_random_uuid()`, que já é nativo no Postgres 13+.

### 2c. Conferir se veio tudo
```bash
psql "postgres://usuario:senha@147.79.82.97:5433/mastergreen" -c "\dt"
psql "postgres://usuario:senha@147.79.82.97:5433/mastergreen" -c "select count(*) from users;"
psql "postgres://usuario:senha@147.79.82.97:5433/mastergreen" -c "select count(*) from quotations;"
```

Devem aparecer as 7 tabelas (users, customers, products, quotations, quotation_items,
costs, quotation_costs) com os dados reais de vocês.

### 2d. Fechar o acesso remoto
Volte no serviço Postgres e **remova a porta pública** (Remote Access). A partir daqui o
banco só é acessível pela rede interna do EasyPanel — mais seguro.

---

## Passo 3 — Criar o serviço App

1. No mesmo projeto → **+ Service → App**.
2. **Source**: GitHub → repositório `GabrielTrindade20/SistemaMastergreen`, branch `replit-agent`.
   (Se o EasyPanel pedir, autorize o acesso ao GitHub.)
3. **Builder**: deixe em **Dockerfile** (o repo já tem um; o EasyPanel detecta sozinho).
4. **Environment** — cole as variáveis (use a URL **interna** do Passo 1):

   ```
   DATABASE_URL=postgres://usuario:senha@mastergreen_db:5432/mastergreen
   PGSSL=false
   NODE_ENV=production
   PORT=5000
   SESSION_SECRET=<gere uma chave: openssl rand -hex 32>
   ```

5. **Domains & Proxy**:
   - Adicione seu domínio (ex.: `sistema.mastergreen.com.br`).
   - **Proxy port**: `5000` (a porta que o app escuta).
   - Ative o **HTTPS** (Let's Encrypt grátis).
6. Clique em **Deploy**. Acompanhe em **Logs** até aparecer `serving on port 5000`.

> DNS: aponte um registro **A** do seu domínio para `147.79.82.97`. O EasyPanel emite o
> certificado assim que o domínio resolver para a VPS.

---

## Passo 4 — Verificar

1. Acesse `https://seu-dominio` — a tela de login deve abrir.
2. Entre com um usuário **real** de vocês (o que já usam hoje). Como restauramos os dados
   da Neon, os usuários e orçamentos existentes estarão lá.
3. Confira um orçamento antigo e a geração de PDF.

> Observação: aqueles usuários padrão (admin@mastergreen.com etc.) só seriam criados se a
> tabela `users` estivesse **vazia**. Com os dados reais importados, isso não acontece.

---

## Passo 5 — Segurança pós-migração (importante)

- **Troque a senha do banco Neon.** A string de conexão foi compartilhada durante o processo;
  depois que confirmar que a VPS está 100% funcionando, gere uma nova senha na Neon (ou apague
  o projeto Neon). Assim a credencial antiga deixa de valer.
- Depois de tudo validado por alguns dias, você pode **desligar o app no Replit** e **encerrar
  a Neon** — nada mais depende deles.
- (Melhoria futura, opcional) As senhas dos usuários estão salvas em texto puro no banco.
  Vale, num próximo passo, aplicar hash (bcrypt). Posso te ajudar quando quiser.

---

## Resumo dos valores do seu ambiente

- VPS Hostinger: `147.79.82.97` (srv1269569.hstgr.cloud, KVM 2) com EasyPanel
- Repositório: `github.com/GabrielTrindade20/SistemaMastergreen` (branch `replit-agent`)
- Origem dos dados: Neon (`ep-delicate-glade-afhtezpi` / banco `neondb`)
- Destino dos dados: serviço Postgres no EasyPanel
