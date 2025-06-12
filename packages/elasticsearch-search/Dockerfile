FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/elasticsearch-search/package.json ./packages/elasticsearch-search/

RUN pnpm install --frozen-lockfile

COPY packages/elasticsearch-search ./packages/elasticsearch-search/
WORKDIR /app/packages/elasticsearch-search
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 