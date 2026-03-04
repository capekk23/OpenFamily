FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/supervisor/package.json ./packages/supervisor/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/supervisor/node_modules ./packages/supervisor/node_modules
COPY tsconfig.base.json ./
COPY packages/supervisor ./packages/supervisor
RUN pnpm --filter @openfamily/supervisor build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/packages/supervisor/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/supervisor/node_modules ./packages/supervisor/node_modules
EXPOSE 3003
CMD ["node", "dist/server.js"]
