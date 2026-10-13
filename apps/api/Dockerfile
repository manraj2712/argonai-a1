# One image for the API, the worker and the migration job; compose picks the command.
FROM node:22.18-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@image-intake/api..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @image-intake/shared build && pnpm --filter @image-intake/api build

FROM node:22.18-bookworm-slim
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
# the prisma CLI is a dev dependency but the migrate job needs it, so dependencies come over whole
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
