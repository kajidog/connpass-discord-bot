// Domain types
export type {
  FeedConfig,
  FeedOrder,
  FeedState,
  Feed,
  User,
  AdminUser,
  BannedUser,
  NewEventsPayload,
  ConnpassEvent,
  // AI Agent 関連
  EventSummaryCache,
  SearchEventsParams,
  DateRange,
} from './domain/types.js';

export { ORDER_MAP, DEFAULTS } from './domain/types.js';

// Repository interfaces
export type { IFeedStore } from './repositories/IFeedStore.js';
export type { IUserStore } from './repositories/IUserStore.js';
export type { IAdminStore } from './repositories/IAdminStore.js';
export type { IBanStore } from './repositories/IBanStore.js';
export type { ISummaryCacheStore } from './repositories/ISummaryCacheStore.js';
export type { IChannelModelStore } from './repositories/IChannelModelStore.js';
export type {
  IUserNotifySettingsStore,
  UserNotifySettings,
} from './repositories/IUserNotifySettingsStore.js';
export type {
  IUserNotifySentStore,
  UserNotifySent,
} from './repositories/IUserNotifySentStore.js';
export type {
  ILogReader,
  ActionLogRecord,
  LogReaderOptions,
} from './repositories/ILogReader.js';

// AI Model Configuration
export type { AIProvider, ModelConfig, AIModelsConfig, ChannelModelConfig } from './ai/index.js';

// Logger
export {
  LogLevel,
  LogDestination,
  ActionType,
  parseLogLevel,
  parseLogDestination,
  logLevelToString,
  Logger,
  ConsoleLogWriter,
  createComponentLogger,
} from './logger/index.js';

export type {
  LogEntry,
  ActionLogEntry,
  LogConfig,
  ILogWriter,
  ILogger,
} from './logger/index.js';

// Config validation
export type { AppConfig, RawEnvConfig, ValidationResult, ValidationError } from './config/index.js';
export {
  validateConfig,
  loadConfigOrThrow,
  parseBoolean,
  parsePositiveInt,
  CONFIG_DEFAULTS,
  CONFIG_CONSTRAINTS,
} from './config/index.js';

// Command handlers (CLI/TUI compatible)
export type {
  CommandContext,
  CommandResponse,
  FeedSetOptions,
  IScheduler,
  PrefectureNameResolver,
} from './commands/index.js';

export {
  SCHEDULE_LABELS,
  handleFeedSetCore,
  handleFeedStatusCore,
  handleFeedRemoveCore,
  handleFeedShareCore,
  handleFeedApplyCore,
  generateFeedCommand,
  generateDiscordFeedCommand,
} from './commands/index.js';
