# Imagem ÚNICA para os dois serviços Railway da ADR 0005 (`api` e `worker`).
# O que muda entre eles é só o comando de start — mesma imagem, mesmo build:
#
#   api     → node dist/main
#   worker  → node dist/worker    (sobrescreva o start command no serviço)
#
# Build a partir de apps/api:
#   docker build -t boilerplate-api .
#   docker run --rm -p 3000:3000 --env-file .env boilerplate-api

# ─────────────────────────────────────────────────────────────────────────────
# base — pinado na mesma major do .nvmrc e do engines do package.json (Node 24).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
WORKDIR /app
# tini vira o PID 1 e repassa SIGTERM ao Node, além de recolher processos
# zumbis. Sem ele, o `enableShutdownHooks()` do Nest pode nunca ser acionado
# num deploy e o pool do Postgres fica pendurado no Neon.
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# ─────────────────────────────────────────────────────────────────────────────
# build — precisa das devDependencies (TypeScript, @nestjs/cli).
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
# `--legacy-peer-deps` também aqui: o lockfile FOI GERADO com a flag (ADR 0009),
# e o npm ci precisa lê-lo com a mesma estratégia de resolução.
RUN npm ci --legacy-peer-deps
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# runtime — só o necessário para rodar.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# `--omit=dev` sobre o lockfile da ADR 0009 → sem vitest/vite/esbuild/drizzle-kit.
# Medido: 149 MB em vez de 224 MB, e zero vulnerabilidades na árvore instalada.
# Se este passo começar a instalar ferramenta de teste, o lockfile foi
# regenerado sem `--legacy-peer-deps` — leia a ADR 0009 antes de "consertar".
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /app/dist ./dist

# `node` já existe na imagem oficial. Rodar como root num contêiner que serve
# HTTP público não tem justificativa.
USER node

EXPOSE 3000

# Sobrescrito para `node dist/worker` no serviço worker.
CMD ["node", "dist/main"]

# Sem HEALTHCHECK de propósito: a mesma imagem serve o worker, que não abre
# porta HTTP — um healthcheck embutido marcaria o worker como unhealthy para
# sempre. O healthcheck é configurado POR SERVIÇO no Railway:
#   api    → GET /health/ready
#   worker → nenhum (processo sem HTTP)
