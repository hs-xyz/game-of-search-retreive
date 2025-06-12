FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/postgresql-search/package.json ./packages/postgresql-search/

RUN pnpm install --frozen-lockfile

COPY packages/postgresql-search ./packages/postgresql-search/
WORKDIR /app/packages/postgresql-search
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 