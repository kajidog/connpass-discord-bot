FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Workspaces metadata first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/job/package.json packages/job/package.json
COPY packages/discord-bot/package.json packages/discord-bot/package.json

RUN pnpm install --frozen-lockfile

# Copy sources
COPY . .

# Build specific packages only (exclude mastra)
RUN pnpm --filter=api-client --filter=job --filter=discord-bot build

ENV NODE_ENV=production

# Bot starts here
CMD ["node", "packages/discord-bot/dist/index.js"]

