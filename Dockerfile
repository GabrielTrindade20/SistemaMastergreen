# ---------- Estagio de build ----------
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Instala TODAS as dependencias (inclui devDependencies necessarias pro build:
# vite, esbuild, plugins). Nao usar NODE_ENV=production aqui.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do codigo e gera o build
# (Vite -> dist/public, esbuild -> dist/index.js)
COPY . .
RUN npm run build

# Production-only dependencies, independent of the build toolchain.
FROM ${NODE_IMAGE} AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Estagio de runtime ----------
FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Migrations are applied explicitly before deploy, using the build stage/admin
# workflow. Never run db:push automatically when the production service starts.
COPY --from=build /app/migrations ./migrations
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# O app le a porta de process.env.PORT (padrao 5000).
EXPOSE 5000

CMD ["node", "dist/index.js"]
