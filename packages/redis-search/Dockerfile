FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/redis-search/package.json ./packages/redis-search/

RUN pnpm install --frozen-lockfile

COPY packages/redis-search ./packages/redis-search/
WORKDIR /app/packages/redis-search
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 