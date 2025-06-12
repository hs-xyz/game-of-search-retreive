FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY packages/search-framework ./packages/search-framework/
COPY packages/mongodb-search/package.json ./packages/mongodb-search/

RUN pnpm install --frozen-lockfile

COPY packages/mongodb-search ./packages/mongodb-search/
WORKDIR /app/packages/mongodb-search
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 