# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Connpass Discord Bot monorepo that fetches events from the Connpass API and sends notifications to Discord channels. The bot supports scheduled fetching, filtering, AI-powered summaries, and user interaction through slash commands and message buttons.

## Package Structure

- `packages/api-client`: TypeScript client for Connpass API v2
- `packages/job`: Job scheduler and manager library with file/memory persistence
- `packages/discord-bot`: Main Discord bot with slash commands and message interactions
- `packages/mastra`: Optional AI summarization service using Mastra Agent API
- `packages/mcp-server`: Optional MCP (Model Context Protocol) server for Connpass API access

## Development Commands

### Build and Setup
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build
# or
pnpm build

# Start development with watch mode
pnpm -r dev
# or
pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @connpass-discord-bot/job test
```

### Linting and Type Checking
```bash
# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck
```

### Discord Bot Operations
```bash
# Register Discord slash commands (required after changes)
pnpm --filter @connpass-discord-bot/discord-bot run register

# Start the Discord bot
pnpm --filter @connpass-discord-bot/discord-bot start
```

## Architecture Overview

### Job System
The core job system (`packages/job`) manages scheduled tasks with pluggable components:

- **JobManager**: Handles CRUD operations for jobs and executes them
- **JobScheduler**: Two execution modes:
  - `interval`: Legacy setInterval-based scheduling
  - `scheduled`: New nextRunAt-based scheduling (default)
- **JobStore**: Persistence layer with implementations:
  - `InMemoryJobStore`: Memory-only (lost on restart)
  - `FileJobStore`: File-based persistence (survives restarts)
- **JobSink**: Output interface (Discord notifications, console logging)

### Discord Integration
The Discord bot (`packages/discord-bot`) implements:

- **DiscordSink**: Handles event notifications and report posting to Discord
- **Slash Commands**: Channel-specific job configuration via `/connpass` commands
- **Message Buttons**: Interactive buttons on event posts for details, speakers, conflict checking
- **Thread Management**: Creates dedicated threads for event details

### API Client
The Connpass API client (`packages/api-client`) follows clean architecture:

- **Domain Layer**: Entities (Event, User, Group), repositories, errors
- **Application Layer**: Services for business logic, main ConnpassClient
- **Infrastructure Layer**: HTTP client, concrete repository implementations

### Key Data Flow
1. JobScheduler triggers job execution based on intervals or nextRunAt timestamps
2. JobManager fetches events from Connpass API using configured filters
3. New events are identified using `updatedAt` timestamps and event IDs
4. DiscordSink posts new events to configured Discord channels
5. Users interact via slash commands to manage job configurations
6. Optional AI summaries via Mastra Agent API for report generation

## Configuration

### Environment Variables
Required variables (see `.env.example`):
- `DISCORD_BOT_TOKEN`: Discord bot token
- `DISCORD_APPLICATION_ID`: Discord application ID
- `CONNPASS_API_KEY`: Connpass API key

Optional variables:
- `DISCORD_GUILD_ID`: Guild-scoped command registration
- `JOB_STORE_DIR`: File persistence directory (e.g., `./data/jobs`)
- `MASTRA_BASE_URL`: AI summarization service URL
- `OPENAI_API_KEY`: Required for Mastra service
- `SCHEDULE_MODE`: `interval` or `scheduled` (default: `scheduled`)

### Job Configuration Structure
Jobs are defined by `JobConfig` interface in `packages/job/src/domain/types.ts`:
- Event filtering: keywords (AND/OR), date ranges, prefectures, hashtags, owner nicknames
- Execution timing: intervalSec, nextRunAt timestamps
- AI settings: report templates, AI enabled flags
- Channel-specific settings stored per Discord channel ID

## Testing Strategy

Test files use Vitest framework and cover:
- **JobManager**: New event detection, location filtering, updatedAt re-notification logic
- **JobScheduler**: Initial execution behavior, interval-based execution with fake timers
- **FileJobStore**: CRUD operations, Set serialization/deserialization, corrupted JSON handling

## Docker Deployment

Use `deploy/docker-compose.yml` which includes:
- `mastra` service: AI summarization API (port 4111)
- `discord-bot` service: Main bot with automatic `MASTRA_BASE_URL` configuration
- Persistent storage mounted to `./data/jobs`

## Key Implementation Notes

### Scheduling Modes
- **Interval Mode**: Uses `setInterval` for regular polling (legacy)
- **Scheduled Mode**: Uses `nextRunAt` timestamps with 1-minute checker (new default)
- Rate limiting: 1.1-second intervals between job executions

### Event Deduplication
- Primary: Uses `updatedAt` timestamp comparison
- Secondary: Tracks `seenEventIds` Set for additional protection
- Supports re-notification when events are updated

### Discord Integration Patterns
- Job ID equals Discord channel ID for 1:1 mapping
- Slash command options use autocompletion for prefectures
- Message embeds include event details with OG image attachment (max 5MB)
- Interactive buttons create threads for detailed information

### AI Integration
- Optional Mastra Agent API integration for event summarization
- Fallback to non-AI reports when Mastra is unavailable
- Custom summary templates supported per channel