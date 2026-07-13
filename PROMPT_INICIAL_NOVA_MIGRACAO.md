# Prompt inicial — Migrar outro projeto (Replit/Neon -> VPS Hostinger + EasyPanel)

Abra um chat novo, selecione a pasta do projeto a migrar e cole o texto abaixo.
Preencha os campos entre colchetes com os dados do novo projeto.

---

Preciso migrar este projeto do **Replit (com banco Neon)** para a minha **VPS Hostinger que roda
EasyPanel** (Docker + Traefik), exatamente como já fiz num projeto anterior. Você tem acesso à
pasta do projeto. Antes de mudar qualquer coisa, **leia o README/replit.md e a estrutura do código
para entender o projeto**, e me diga o plano antes de executar.

## Dados do novo projeto (eu preencho)
- O que o sistema faz: [breve descrição]
- Stack (se souber): [ex.: Node/Express + React/Vite + Postgres/Drizzle, ou outro]
- Repositório GitHub: [usuario/repo] — branch: [branch]
- URL do banco Neon (produção, para migrar os dados): [postgresql://...neon.tech/...?sslmode=require]
- VPS Hostinger com EasyPanel: já tenho (mesma de antes). Quero domínio/HTTPS: [sim/não; qual domínio]

## Objetivo
App e banco rodando 100% na VPS (EasyPanel): um serviço **App** (build via Dockerfile) e um
serviço **Postgres**, sem depender mais do Replit nem do Neon. Manter os dados existentes.

## Lições da migração anterior — já considere tudo isto para não travar de novo
1. **Driver do banco**: se o projeto usar `@neondatabase/serverless`, troque por `pg`
   (node-postgres) + `drizzle-orm/node-postgres`. Adicione `pg` e `@types/pg`; remova o pacote da
   Neon. Faça o SSL condicional (ligado p/ Neon/`sslmode=require`, desligado p/ Postgres interno).
2. **`npm ci` no Docker exige `package.json` e `package-lock.json` em sincronia.** Sempre que
   mexer no `package.json`, regenere o lock (`npm install`), valide com `npm ci --dry-run` e
   commite o lock. Foi o erro nº1 que quebrou o build.
3. **Servidor precisa rodar standalone**: confira se o `server/index.ts` (ou equivalente) importa
   tudo que usa (ex.: `log`, `serveStatic`, tipos do Express) — templates do Replit às vezes vêm
   com imports faltando que só quebram fora do Replit.
4. **Dockerfile**: multi-stage (build instala TODAS as deps e roda `npm run build`; runtime mantém
   `node_modules` completo porque o bundle costuma importar vite/plugins em runtime). Exponha a
   porta que o app escuta (ex.: 5000). Inclua `shared/` e `drizzle.config.ts` no runtime se quiser
   rodar `db:push` pelo Console.
5. **EasyPanel — porta do proxy**: em App -> Domains, a porta do proxy TEM que ser a mesma que o
   app escuta (ex.: 5000). O padrão do EasyPanel é 3000 -> se esquecer, dá "Service is not reachable"
   mesmo com o app rodando.
6. **`DATABASE_URL`**: use a "URL de Conexão Interna" COMPLETA das credenciais do Postgres do
   EasyPanel (com `usuario:senha@host:5432/banco`). Faltar a senha dá erro SASL; senha com
   caractere especial não codificado faz o host virar lixo (`ENOTFOUND`). Se a senha tiver
   caractere especial, ou codifique na URL, ou ajuste o código para aceitar `PGHOST/PGUSER/
   PGPASSWORD/PGDATABASE` separados.
7. **`SESSION_SECRET`**: gere uma chave real (`openssl rand -hex 32`), não deixe texto de exemplo.
8. **Assets/imagens**: caminhos tipo `src="/src/..."` funcionam no Replit mas quebram no build de
   produção do Vite. Importe o asset (`import logo from "@/.../logo.png"`) para o Vite versionar.
9. **Migração dos dados**: `pg_dump "<URL_NEON>" --no-owner --no-acl -f backup.sql` e
   `psql "<URL_POSTGRES_VPS>" -f backup.sql` num banco vazio. Rode de um lugar que alcance os dois
   (Shell do Replit ou a própria VPS). Depois desabilite o Remote Access do Postgres.
10. **Riscos comuns herdados do template** (avaliar e sugerir correção): `throw err` no middleware
    de erro do Express (derruba o processo); sessões em `MemoryStore` (deslogam a cada deploy ->
    trocar por `connect-pg-simple`); senhas em texto puro (-> hash bcrypt).

## Como quero trabalhar
- Me faça perguntas de esclarecimento antes de executar passos grandes.
- Sempre que gerar/alterar arquivos, **valide o build** (`npm ci` + `npm run build`) antes de
  concluir.
- Não teste escrita na produção; use Postgres descartável para testes funcionais.
- No fim, me entregue um guia de deploy (passo a passo no EasyPanel) e um resumo do que mudou.

Comece lendo o projeto e me apresentando o plano.
