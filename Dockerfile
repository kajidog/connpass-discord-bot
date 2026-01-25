FROM node:22-alpine

WORKDIR /app

# better-sqlite3のビルドに必要な依存関係
RUN apk add --no-cache python3 make g++ gcc libc-dev

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY apps/ai-agent/package.json apps/ai-agent/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/discord-bot/package.json apps/discord-bot/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/feed-worker/package.json packages/feed-worker/package.json

# ネイティブモジュールをソースからビルド
ENV npm_config_build_from_source=true
RUN pnpm install --frozen-lockfile

COPY apps apps
COPY packages packages

RUN pnpm -r build

CMD ["pnpm", "--filter", "@connpass-discord-bot/discord-bot", "dev"]
