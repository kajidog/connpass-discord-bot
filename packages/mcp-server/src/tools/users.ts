import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnpassClient } from "@connpass-discord-bot/api-client";

import {
  applyPagination,
  EVENT_SORT_KEYS,
  EVENT_SORT_MAP,
  USER_SORT_KEYS,
  USER_SORT_MAP,
} from "./shared.js";

const UserSearchInputSchema = z.object({
  nickname: z
    .string()
    .min(1)
    .describe("Match users by nickname (substring search)")
    .optional(),
  userIds: z
    .array(z.number())
    .describe("Limit results to these user IDs")
    .optional(),
  page: z
    .number()
    .int()
    .min(1)
    .describe("1-based page number")
    .optional(),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("How many users per page (default 20)")
    .optional(),
  sort: z
    .enum(USER_SORT_KEYS)
    .describe("Ranking by activity, followers, or recency")
    .optional(),
});

type UserSearchInput = z.infer<typeof UserSearchInputSchema>;

const UserGroupsInputSchema = z.object({
  userId: z
    .number()
    .int()
    .positive()
    .describe("Connpass user ID, findable via search_users"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("How many items to return (default 20)")
    .optional(),
  page: z
    .number()
    .int()
    .min(1)
    .describe("1-based page number")
    .optional(),
});

const UserRelationshipInputSchema = z.object({
  userId: z
    .number()
    .int()
    .positive()
    .describe("Connpass user ID, findable via search_users"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("How many items to return (default 20)")
    .optional(),
  page: z
    .number()
    .int()
    .min(1)
    .describe("1-based page number")
    .optional(),
  sort: z
    .enum(EVENT_SORT_KEYS)
    .describe("Sort events by schedule or recency")
    .optional(),
});

type UserRelationshipInput = z.infer<typeof UserRelationshipInputSchema>;

function buildUserSearchParams(
  input: UserSearchInput,
  options?: { includePagination?: boolean }
) {
  const pagination = applyPagination(input.page, input.pageSize, options);
  return {
    nickname: input.nickname,
    userId: input.userIds,
    order: input.sort ? USER_SORT_MAP[input.sort] : undefined,
    ...pagination,
  };
}

function buildUserRelationshipParams(input: UserRelationshipInput) {
  const pagination = applyPagination(input.page, input.limit, { includePagination: true });
  return {
    pagination,
    order: input.sort ? EVENT_SORT_MAP[input.sort] : undefined,
  };
}

const userToolsInternal: Tool[] = [
  {
    name: "search_users",
    description: "Discover Connpass users",
    inputSchema: {
      type: "object",
      properties: {
        nickname: {
          type: "string",
          description: "Match users whose nickname contains this text",
        },
        userIds: {
          type: "array",
          items: { type: "number" },
          description: "Only show these specific user IDs",
        },
        page: {
          type: "integer",
          minimum: 1,
          description: "1-based page number (default 1)",
        },
        pageSize: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Users per page (default 20)",
        },
        sort: {
          type: "string",
          enum: [...USER_SORT_KEYS],
          description: "Rank by event participation, followers, or recency",
        },
      },
    },
  },
  {
    name: "get_user_groups",
    description: "List the groups a user belongs to",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "integer",
          description: "Connpass user ID",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "How many groups to return (default 20)",
        },
        page: {
          type: "integer",
          minimum: 1,
          description: "1-based page number (default 1)",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_user_attended_events",
    description: "List events that a user has attended",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "integer",
          description: "Connpass user ID",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "How many events to return (default 20)",
        },
        page: {
          type: "integer",
          minimum: 1,
          description: "1-based page number (default 1)",
        },
        sort: {
          type: "string",
          enum: [...EVENT_SORT_KEYS],
          description: "Sort by schedule or recency",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_user_presenter_events",
    description: "List events where the user presented",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "integer",
          description: "Connpass user ID",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "How many events to return (default 20)",
        },
        page: {
          type: "integer",
          minimum: 1,
          description: "1-based page number (default 1)",
        },
        sort: {
          type: "string",
          enum: [...EVENT_SORT_KEYS],
          description: "Sort by schedule or recency",
        },
      },
      required: ["userId"],
    },
  },
];

const userHandlers = {
  async search_users(args: unknown, connpassClient: ConnpassClient) {
    const params = UserSearchInputSchema.parse(args ?? {});
    const searchParams = buildUserSearchParams(params);
    return connpassClient.searchUsers(searchParams);
  },
  async get_user_groups(args: unknown, connpassClient: ConnpassClient) {
    const { userId, limit, page } = UserGroupsInputSchema.parse(args ?? {});
    const pagination = applyPagination(page, limit);
    return connpassClient.getUserGroups(userId, pagination);
  },
  async get_user_attended_events(args: unknown, connpassClient: ConnpassClient) {
    const parsed = UserRelationshipInputSchema.parse(args ?? {});
    const { pagination, order } = buildUserRelationshipParams(parsed);
    return connpassClient.getUserAttendedEvents(parsed.userId, {
      ...pagination,
      order,
    });
  },
  async get_user_presenter_events(args: unknown, connpassClient: ConnpassClient) {
    const parsed = UserRelationshipInputSchema.parse(args ?? {});
    const { pagination, order } = buildUserRelationshipParams(parsed);
    return connpassClient.getUserPresenterEvents(parsed.userId, {
      ...pagination,
      order,
    });
  },
};

export type UserToolName = keyof typeof userHandlers;

export const userTools = userToolsInternal;

export function isUserTool(name: string): name is UserToolName {
  return name in userHandlers;
}

export async function handleUserTool(
  name: UserToolName,
  args: unknown,
  connpassClient: ConnpassClient
) {
  return userHandlers[name](args, connpassClient);
}
