FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ curl

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/search-framework ./packages/search-framework/
COPY packages/leveldb-search/package.json ./packages/leveldb-search/

RUN pnpm install --frozen-lockfile

COPY packages/leveldb-search ./packages/leveldb-search/
WORKDIR /app/packages/leveldb-search
RUN pnpm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD pnpm run health-check

CMD ["pnpm", "start"] 