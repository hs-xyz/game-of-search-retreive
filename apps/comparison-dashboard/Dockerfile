FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-utils ./packages/shared-utils/
COPY apps/comparison-dashboard/package.json ./apps/comparison-dashboard/

RUN pnpm install --frozen-lockfile

COPY apps/comparison-dashboard ./apps/comparison-dashboard/
WORKDIR /app/apps/comparison-dashboard
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"] 