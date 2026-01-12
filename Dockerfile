FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps/discord-bot/package.json apps/discord-bot/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/feed-worker/package.json packages/feed-worker/package.json

RUN pnpm install --frozen-lockfile

COPY apps apps
COPY packages packages

RUN pnpm -r build

CMD ["pnpm", "--filter", "@connpass-discord-bot/discord-bot", "dev"]
