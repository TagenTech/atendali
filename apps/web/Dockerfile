# Web Agendei (Next.js standalone) — build a partir da raiz do monorepo:
#   docker build -f apps/web/Dockerfile -t agendei-web .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @agendei/web...
COPY packages/contracts packages/contracts
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# As rewrites do Next são resolvidas no build (o nginx já manda /api direto para a API).
ARG API_URL=http://api:3200
ENV API_URL=$API_URL
RUN pnpm --filter @agendei/contracts build && pnpm --filter @agendei/web build

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3201 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3201
CMD ["node", "apps/web/server.js"]
