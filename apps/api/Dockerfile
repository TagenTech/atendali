# API Agendei — build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t agendei-api .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @agendei/api...
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @agendei/contracts build && pnpm --filter @agendei/api build
RUN pnpm --filter @agendei/api deploy --prod /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3200
# As migrations rodam na subida (migrationsRun); TYPEORM_SYNC fica desligado em produção.
CMD ["node", "dist/main"]
