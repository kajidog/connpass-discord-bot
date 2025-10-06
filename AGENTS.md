# Repository Guidelines

## Project Structure & Module Organization
- `packages/api-client/`: TypeScript Connpass API client with domain entities, infrastructure, and service layers.
- `packages/mcp-server/`: MCP server exposing Connpass tooling (`src/tools/` contains event/group/user modules).
- `packages/discord-bot/` (if present): Discord bot integration; check package subdirectories for feature-specific code.
- Shared scripts live under `scripts/`, deployment configs under `deploy/`, data fixtures in `data/`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm --filter @connpass-discord-bot/mcp-server build`: compile the MCP server to `dist/`.
- `pnpm --filter @connpass-discord-bot/mcp-server dev`: type-check in watch mode for rapid iterations.
- `pnpm --filter @connpass-discord-bot/mcp-server typecheck`: run TypeScript checks without emitting output.
- Use analogous `--filter` flags for other packages (e.g., `@connpass-discord-bot/api-client`).

## Coding Style & Naming Conventions
- TypeScript throughout; prefer ES modules with explicit `.js` extensions in compiled imports.
- Two-space indentation in JSON, otherwise follow Prettier defaults (4 spaces in TS/JS as currently used).
- Tool names and file names use kebab-case; exported TypeScript types and classes use PascalCase.
- Run `pnpm lint` in package directories when available.

## Testing Guidelines
- Type safety enforced via `tsc`; add unit tests under each package’s `__tests__` or `tests/` directory when introducing logic-heavy modules.
- Name test files `<feature>.test.ts` and co-locate with source where practical.
- Ensure new tools have validation scenarios (Zod schemas) and confirm via `typecheck` before submitting.

## Commit & Pull Request Guidelines
- Follow conventional, present-tense commit messages (`feat: add upcoming events tool`).
- Keep commits scoped to one logical change; include README/docs updates alongside code adjustments.
- Pull requests should describe motivation, implementation summary, and testing evidence (`pnpm typecheck`, manual verification). Link related issues and attach screenshots/log excerpts for user-facing changes.

## Security & Configuration Tips
- Store credentials (Connpass API key, default user ID) in environment variables (`.env.local` ignored by git).
- Respect the Connpass API rate limit (approx. 1 req/sec); batching helper functions already throttle via `HttpClient`.
