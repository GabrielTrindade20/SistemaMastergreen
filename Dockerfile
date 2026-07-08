# ---------- Estagio de build ----------
FROM node:20-slim AS build
WORKDIR /app

# Instala TODAS as dependencias (inclui devDependencies necessarias pro build:
# vite, esbuild, plugins). Nao usar NODE_ENV=production aqui.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do codigo e gera o build
# (Vite -> dist/public, esbuild -> dist/index.js)
COPY . .
RUN npm run build

# ---------- Estagio de runtime ----------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# O bundle do servidor importa vite/plugins em tempo de execucao (heranca do
# template Replit), entao mantemos node_modules completo do estagio de build.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Arquivos necessarios para rodar "npm run db:push" (criar tabelas) pelo Console.
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/shared ./shared

# O app le a porta de process.env.PORT (padrao 5000).
EXPOSE 5000

CMD ["node", "dist/index.js"]
