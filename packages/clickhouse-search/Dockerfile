FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/search-framework ./packages/search-framework/
COPY packages/clickhouse-search/package.json ./packages/clickhouse-search/

RUN pnpm install --frozen-lockfile

COPY packages/clickhouse-search ./packages/clickhouse-search/
WORKDIR /app/packages/clickhouse-search
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 