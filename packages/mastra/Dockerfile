# syntax=docker/dockerfile:1

# Simple production image for Mastra server (packages/mastra)
# - Builds the Mastra project and runs `mastra start`
# - Exposes port 4111 for the Agent/Workflow API

FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install dependencies (only this package)
COPY packages/mastra/package.json ./package.json
# Note: Avoid using package-lock due to npm optional deps bug with rollup
# https://github.com/npm/cli/issues/4828
RUN npm install

# Copy source
COPY packages/mastra/tsconfig.json ./tsconfig.json
COPY packages/mastra/src ./src

# Build server assets with Mastra CLI
RUN npm run build

# Runtime stage (keep CLI to run `mastra start`)
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Copy node_modules and built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/tsconfig.json ./tsconfig.json
COPY --from=base /app/src ./src
COPY --from=base /app/.mastra ./.mastra

# Default port for Mastra dev/server
ENV PORT=4111
EXPOSE 4111

# Environment variables expected at runtime (set via -e or compose):
# - OPENAI_API_KEY=<your key>
# - MASTRA_TELEMETRY_DISABLED=1 (optional)

CMD ["npm", "run", "start"]
