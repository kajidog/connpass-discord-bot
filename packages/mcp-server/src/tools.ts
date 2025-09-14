import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnpassClient } from "@connpass-discord-bot/api-client";

// Event search parameters schema
export const EventSearchParamsSchema = z.object({
  eventId: z.array(z.number()).optional(),
  keyword: z.string().optional(),
  keywordOr: z.string().optional(),
  ymd: z.array(z.string()).optional(),
  ymdFrom: z.string().optional(),
  ymdTo: z.string().optional(),
  nickname: z.string().optional(),
  ownerNickname: z.string().optional(),
  groupId: z.array(z.number()).optional(),
  prefecture: z.array(z.string()).optional(),
  start: z.number().optional(),
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  count: z.number().min(1).max(100).optional(),
});

// Group search parameters schema
export const GroupSearchParamsSchema = z.object({
  groupId: z.array(z.number()).optional(),
  keyword: z.string().optional(),
  countryCode: z.string().optional(),
  prefecture: z.string().optional(),
  start: z.number().optional(),
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  count: z.number().min(1).max(100).optional(),
});

// User search parameters schema
export const UserSearchParamsSchema = z.object({
  userId: z.array(z.number()).optional(),
  nickname: z.string().optional(),
  start: z.number().optional(),
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  count: z.number().min(1).max(100).optional(),
});

export const tools: Tool[] = [
  {
    name: "search_events",
    description: "Search for events on Connpass",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "array",
          items: { type: "number" },
          description: "Array of event IDs to search for"
        },
        keyword: {
          type: "string",
          description: "Keyword for search"
        },
        keywordOr: {
          type: "string",
          description: "Keywords for OR search"
        },
        ymd: {
          type: "array",
          items: { type: "string" },
          description: "Array of year-month-day filters (YYYYMMDD format)"
        },
        ymdFrom: {
          type: "string",
          description: "Start date filter (YYYYMMDD format)"
        },
        ymdTo: {
          type: "string",
          description: "End date filter (YYYYMMDD format)"
        },
        nickname: {
          type: "string",
          description: "Participant nickname"
        },
        ownerNickname: {
          type: "string",
          description: "Event owner nickname"
        },
        groupId: {
          type: "array",
          items: { type: "number" },
          description: "Array of group IDs"
        },
        prefecture: {
          type: "array",
          items: { type: "string" },
          description: "Array of prefecture names"
        },
        start: {
          type: "number",
          description: "Start index for pagination (default: 1)"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event date ascending, 2=event date descending, 3=new arrivals"
        },
        count: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of events to return (default: 10, max: 100)"
        }
      }
    }
  },
  {
    name: "get_all_events",
    description: "Get all events matching criteria (automatically handles pagination)",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "array",
          items: { type: "number" },
          description: "Array of event IDs to search for"
        },
        keyword: {
          type: "string",
          description: "Keyword for search"
        },
        keywordOr: {
          type: "string",
          description: "Keywords for OR search"
        },
        ymd: {
          type: "array",
          items: { type: "string" },
          description: "Array of year-month-day filters (YYYYMMDD format)"
        },
        ymdFrom: {
          type: "string",
          description: "Start date filter (YYYYMMDD format)"
        },
        ymdTo: {
          type: "string",
          description: "End date filter (YYYYMMDD format)"
        },
        nickname: {
          type: "string",
          description: "Participant nickname"
        },
        ownerNickname: {
          type: "string",
          description: "Event owner nickname"
        },
        groupId: {
          type: "array",
          items: { type: "number" },
          description: "Array of group IDs"
        },
        prefecture: {
          type: "array",
          items: { type: "string" },
          description: "Array of prefecture names"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event date ascending, 2=event date descending, 3=new arrivals"
        }
      }
    }
  },
  {
    name: "get_event_presentations",
    description: "Get presentations for a specific event",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "number",
          description: "Event ID to get presentations for"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "search_groups",
    description: "Search for groups on Connpass",
    inputSchema: {
      type: "object",
      properties: {
        groupId: {
          type: "array",
          items: { type: "number" },
          description: "Array of group IDs"
        },
        keyword: {
          type: "string",
          description: "Keyword to search for"
        },
        countryCode: {
          type: "string",
          description: "Country code filter"
        },
        prefecture: {
          type: "string",
          description: "Prefecture filter"
        },
        start: {
          type: "number",
          description: "Start index for pagination (default: 1)"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event count descending, 2=participant count descending, 3=new arrivals"
        },
        count: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of groups to return (default: 10, max: 100)"
        }
      }
    }
  },
  {
    name: "get_all_groups",
    description: "Get all groups matching criteria (automatically handles pagination)",
    inputSchema: {
      type: "object",
      properties: {
        groupId: {
          type: "array",
          items: { type: "number" },
          description: "Array of group IDs"
        },
        keyword: {
          type: "string",
          description: "Keyword to search for"
        },
        countryCode: {
          type: "string",
          description: "Country code filter"
        },
        prefecture: {
          type: "string",
          description: "Prefecture filter"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event count descending, 2=participant count descending, 3=new arrivals"
        }
      }
    }
  },
  {
    name: "search_users",
    description: "Search for users on Connpass",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "array",
          items: { type: "number" },
          description: "Array of user IDs"
        },
        nickname: {
          type: "string",
          description: "User nickname"
        },
        start: {
          type: "number",
          description: "Start index for pagination (default: 1)"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event count descending, 2=follower count descending, 3=new arrivals"
        },
        count: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Number of users to return (default: 10, max: 100)"
        }
      }
    }
  },
  {
    name: "get_user_groups",
    description: "Get groups for a specific user",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "User ID to get groups for"
        },
        count: {
          type: "number",
          description: "Number of groups to return"
        },
        start: {
          type: "number",
          description: "Start index for pagination"
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "get_user_attended_events",
    description: "Get events that a user has attended",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "User ID to get attended events for"
        },
        count: {
          type: "number",
          description: "Number of events to return"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event date ascending, 2=event date descending, 3=new arrivals"
        },
        start: {
          type: "number",
          description: "Start index for pagination"
        }
      },
      required: ["user_id"]
    }
  },
  {
    name: "get_user_presenter_events",
    description: "Get events where a user was a presenter",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "User ID to get presenter events for"
        },
        count: {
          type: "number",
          description: "Number of events to return"
        },
        order: {
          type: "number",
          enum: [1, 2, 3],
          description: "Sort order: 1=event date ascending, 2=event date descending, 3=new arrivals"
        },
        start: {
          type: "number",
          description: "Start index for pagination"
        }
      },
      required: ["user_id"]
    }
  }
];

export async function handleToolCall(name: string, args: any, connpassClient: ConnpassClient) {
  switch (name) {
    case "search_events": {
      const params = EventSearchParamsSchema.parse(args);
      return await connpassClient.searchEvents(params);
    }

    case "get_all_events": {
      const params = EventSearchParamsSchema.omit({ start: true, count: true }).parse(args);
      return await connpassClient.getAllEvents(params);
    }

    case "get_event_presentations": {
      const { event_id } = z.object({ event_id: z.number() }).parse(args);
      return await connpassClient.getEventPresentations(event_id);
    }

    case "search_groups": {
      const params = GroupSearchParamsSchema.parse(args);
      return await connpassClient.searchGroups(params);
    }

    case "get_all_groups": {
      const params = GroupSearchParamsSchema.omit({ start: true, count: true }).parse(args);
      return await connpassClient.getAllGroups(params);
    }

    case "search_users": {
      const params = UserSearchParamsSchema.parse(args);
      return await connpassClient.searchUsers(params);
    }

    case "get_user_groups": {
      const { user_id, ...otherParams } = z.object({
        user_id: z.number(),
        count: z.number().optional(),
        start: z.number().optional(),
      }).parse(args);
      return await connpassClient.getUserGroups(user_id, otherParams);
    }

    case "get_user_attended_events": {
      const { user_id, ...otherParams } = z.object({
        user_id: z.number(),
        count: z.number().optional(),
        order: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        start: z.number().optional(),
      }).parse(args);
      return await connpassClient.getUserAttendedEvents(user_id, otherParams);
    }

    case "get_user_presenter_events": {
      const { user_id, ...otherParams } = z.object({
        user_id: z.number(),
        count: z.number().optional(),
        order: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        start: z.number().optional(),
      }).parse(args);
      return await connpassClient.getUserPresenterEvents(user_id, otherParams);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}