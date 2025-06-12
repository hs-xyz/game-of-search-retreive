FROM node:22

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/search-framework ./packages/search-framework/
COPY packages/duckdb-search/package.json ./packages/duckdb-search/

RUN pnpm install --frozen-lockfile

COPY packages/duckdb-search ./packages/duckdb-search/
WORKDIR /app/packages/duckdb-search
RUN pnpm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD pnpm run health-check

CMD ["pnpm", "start"] 