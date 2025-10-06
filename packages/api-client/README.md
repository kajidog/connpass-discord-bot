# Connpass API Client

TypeScript client for Connpass API v2 with clean architecture design.

## Installation

```bash
pnpm install @connpass-discord-bot/api-client
```

## Usage

### Basic Usage

```typescript
import { ConnpassClient } from '@connpass-discord-bot/api-client';

const client = new ConnpassClient({
  apiKey: 'your-api-key-here'
});

// Search for events
const events = await client.searchEvents({
  keyword: 'TypeScript',
  count: 10
});

console.log(events.events);
```

### Configuration Options

```typescript
const client = new ConnpassClient({
  apiKey: 'your-api-key-here',
  baseURL: 'https://connpass.com/api/v2', // optional, default value
  timeout: 30000, // optional, default 30 seconds
  rateLimitDelay: 1000, // optional, default 1 second between requests
  enablePresentationCache: true, // optional, default true
  presentationCacheTtlMs: 1000 * 60 * 60, // optional, default 1 hour
  presentationCachePath: './data/presentation-cache.json' // optional, default cwd/data
});
```

If these options are omitted, the client falls back to environment variables:

- `CONNPASS_PRESENTATION_CACHE_ENABLED` (`true`/`false`, defaults to `true`)
- `CONNPASS_PRESENTATION_CACHE_TTL_MS` (millisecond TTL, defaults to `3600000`)
- `CONNPASS_PRESENTATION_CACHE_PATH` (path to persistent cache file, defaults to `./data/presentation-cache.json`)

### Available Methods

#### Events

```typescript
// Search events with pagination
const events = await client.searchEvents({
  keyword: 'JavaScript',
  ymdFrom: '2024-01-01',
  ymdTo: '2024-12-31',
  count: 20,
  start: 1
});

// Get all events (automatically handles pagination)
const allEvents = await client.getAllEvents({
  keyword: 'React'
});

// Get event presentations
const presentations = await client.getEventPresentations(12345);
```

#### Groups

```typescript
// Search groups
const groups = await client.searchGroups({
  keyword: 'JavaScript',
  prefecture: '東京都'
});

// Get all groups
const allGroups = await client.getAllGroups({
  keyword: 'TypeScript'
});
```

#### Users

```typescript
// Search users
const users = await client.searchUsers({
  nickname: 'example_user'
});

// Get user's groups
const userGroups = await client.getUserGroups(12345);

// Get user's attended events
const attendedEvents = await client.getUserAttendedEvents(12345);
const sameResult = await client.getUserAttendedEvents('kajidog');

// Get user's presenter events
const presenterEvents = await client.getUserPresenterEvents(12345);
```

### Error Handling

The client provides specific error types for different scenarios:

```typescript
import { 
  ConnpassError, 
  ConnpassApiError, 
  ConnpassRateLimitError, 
  ConnpassValidationError,
  ConnpassTimeoutError 
} from '@connpass-discord-bot/api-client';

try {
  const events = await client.searchEvents({ keyword: 'TypeScript' });
} catch (error) {
  if (error instanceof ConnpassRateLimitError) {
    console.log('Rate limit exceeded, please wait');
  } else if (error instanceof ConnpassValidationError) {
    console.log('Invalid parameters:', error.message);
  } else if (error instanceof ConnpassApiError) {
    console.log('API error:', error.statusCode, error.message);
  } else if (error instanceof ConnpassTimeoutError) {
    console.log('Request timeout');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

### Search Parameters

#### Event Search Parameters

- `eventId`: Array of event IDs
- `keyword`: Search keyword (AND search)
- `keywordOr`: Search keyword (OR search)
- `ymdFrom`: Start date (YYYY-MM-DD format)
- `ymdTo`: End date (YYYY-MM-DD format)
- `nickname`: Participant nickname
- `ownerNickname`: Event owner nickname
- `groupId`: Array of group IDs
- `count`: Number of results (1-100, default 10)
- `order`: Sort order (1: updated_at desc, 2: started_at asc, 3: started_at desc)
- `start`: Start position for pagination

#### Group Search Parameters

- `groupId`: Array of group IDs
- `keyword`: Search keyword
- `countryCode`: Country code
- `prefecture`: Prefecture
- `count`: Number of results (1-100, default 10)
- `order`: Sort order
- `start`: Start position for pagination

#### User Search Parameters

- `userId`: Array of user IDs
- `nickname`: User nickname
- `count`: Number of results (1-100, default 10)
- `order`: Sort order
- `start`: Start position for pagination

## Features

- ✅ Full TypeScript support with comprehensive type definitions
- ✅ Rate limiting built-in (1 request per second)
- ✅ Automatic pagination support with `getAll*` methods
- ✅ Comprehensive error handling with specific error types
- ✅ Input validation
- ✅ Clean architecture design
- ✅ Easy to test and extend

## License

MIT
