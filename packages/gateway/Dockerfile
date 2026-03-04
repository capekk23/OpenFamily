FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/gateway/package.json ./packages/gateway/
COPY packages/policy-engine/package.json ./packages/policy-engine/
COPY prisma/schema.prisma ./prisma/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/gateway/node_modules ./packages/gateway/node_modules
COPY --from=deps /app/packages/policy-engine/node_modules ./packages/policy-engine/node_modules
COPY tsconfig.base.json ./
COPY packages/policy-engine ./packages/policy-engine
COPY packages/gateway ./packages/gateway
COPY prisma ./prisma
RUN pnpm --filter @openfamily/policy-engine build
RUN pnpm --filter @openfamily/gateway build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/packages/gateway/dist ./dist
COPY --from=build /app/packages/policy-engine/dist ./packages/policy-engine/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/gateway/node_modules ./packages/gateway/node_modules
COPY --from=build /app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/server.js"]
