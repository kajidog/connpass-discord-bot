import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnpassClient } from "@connpass-discord-bot/api-client";

import {
  applyPagination,
  EVENT_SORT_KEYS,
  EVENT_SORT_MAP,
  normalizeStringArray,
  parseDateInput,
  toYmdArray,
} from "./shared.js";
import {
  formatEventList,
  formatEventsResponse,
  formatPresentationsResponse,
  FormatEventOptions,
} from "./formatting.js";
import { getDefaultIncludePresentations, getDefaultUserId } from "../config.js";
import type { Event, PresentationsResponse } from "@connpass-discord-bot/api-client";

const EventSearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search for events that match ALL of these keywords")
    .optional(),
  anyQuery: z
    .string()
    .min(1)
    .describe("Search for events that match ANY of these keywords (comma separated is ok)")
    .optional(),
  on: z
    .union([z.string().min(1), z.array(z.string().min(1))])
    .describe("Specific date(s) to match. Natural language like 'today' or '2024-12-24' is accepted")
    .optional(),
  from: z
    .string()
    .min(1)
    .describe(
      "Start of the date range (inclusive). Natural language like 'next Monday' works when Date.parse can understand it"
    )
    .optional(),
  to: z
    .string()
    .min(1)
    .describe("End of the date range (inclusive). Use together with 'from' for a window")
    .optional(),
  participantNickname: z
    .string()
    .min(1)
    .describe("Filter by participant nickname")
    .optional(),
  hostNickname: z
    .string()
    .min(1)
    .describe("Filter by host / owner nickname")
    .optional(),
  groupIds: z
    .array(z.number())
    .describe("Limit results to specific Connpass group IDs")
    .optional(),
  prefectures: z
    .union([z.string().min(1), z.array(z.string().min(1))])
    .describe("Prefecture name(s) to filter by")
    .optional(),
  page: z
    .number()
    .int()
    .min(1)
    .describe("1-based page number. Each page contains 'pageSize' items")
    .optional(),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("How many events per page (default 20, Connpass max 100)")
    .optional(),
  sort: z
    .enum(EVENT_SORT_KEYS)
    .describe("Sort order: soonest first, latest first, or newly added")
    .optional(),
});

type EventSearchInput = z.infer<typeof EventSearchInputSchema>;

const EventPresentationsInputSchema = z.object({
  eventId: z
    .union([z.number().int().positive(), z.string().min(1)])
    .describe("Connpass event ID")
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value), "eventId must be a number"),
});

const MyUpcomingEventsInputSchema = z.object({
  userId: z
    .number()
    .int()
    .positive()
    .describe("Connpass user ID. If omitted, uses CONNPASS_DEFAULT_USER_ID")
    .optional(),
  daysAhead: z
    .number()
    .int()
    .min(1)
    .max(60)
    .describe("How many days ahead to include (default 7)")
    .optional(),
  maxEvents: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("Maximum number of attended events to examine (default 30)")
    .optional(),
  includePresentations: z
    .boolean()
    .describe(
      "Whether to fetch presentation details for each event. Extra API calls respect the 1 req/sec limit"
    )
    .optional(),
});

function buildEventSearchParams(
  input: EventSearchInput,
  options?: { includePagination?: boolean }
) {
  const pagination = applyPagination(input.page, input.pageSize, options);

  return {
    keyword: input.query,
    keywordOr: input.anyQuery,
    ymd: toYmdArray(input.on),
    ymdFrom: input.from ? parseDateInput(input.from) : undefined,
    ymdTo: input.to ? parseDateInput(input.to) : undefined,
    nickname: input.participantNickname,
    ownerNickname: input.hostNickname,
    groupId: input.groupIds,
    prefecture: normalizeStringArray(input.prefectures),
    order: input.sort ? EVENT_SORT_MAP[input.sort] : undefined,
    ...pagination,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateLabel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type EventWithPresentations = Event & { presentations?: PresentationsResponse["presentations"] };

const DEFAULT_EVENT_FORMAT_OPTIONS: FormatEventOptions = {};

async function maybeAttachPresentations(
  events: Event[],
  includePresentations: boolean | undefined,
  connpassClient: ConnpassClient
): Promise<EventWithPresentations[]> {
  if (!includePresentations || events.length === 0) {
    return events as EventWithPresentations[];
  }

  const enriched: EventWithPresentations[] = [];
  for (const event of events) {
    const presentationsResponse = await connpassClient.getEventPresentations(event.id);
    enriched.push({
      ...event,
      presentations: presentationsResponse.presentations,
    });
  }

  return enriched;
}

const eventToolsInternal: Tool[] = [
  {
    name: "search_events",
    description: "Find Connpass events using natural date phrases and simple filters",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "All keywords that must appear in the event title / description",
        },
        anyQuery: {
          type: "string",
          description: "Any of these keywords may match (OR search, comma separated is ok)",
        },
        on: {
          description:
            "Specific date(s) like '2024-12-24' or 'today'. Accepts a single string or an array",
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
        },
        from: {
          type: "string",
          description: "Inclusive start date. Natural expressions like 'next Monday' are accepted",
        },
        to: {
          type: "string",
          description: "Inclusive end date for the date range",
        },
        participantNickname: {
          type: "string",
          description: "Limit to events joined by this participant nickname",
        },
        hostNickname: {
          type: "string",
          description: "Filter by the host / organiser nickname",
        },
        groupIds: {
          type: "array",
          items: { type: "number" },
          description: "Only show events from these Connpass group IDs",
        },
        prefectures: {
          description: "Prefecture name(s) to match. Single string or array",
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
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
          description: "How many events per page (default 20, Connpass max 100)",
        },
        sort: {
          type: "string",
          enum: [...EVENT_SORT_KEYS],
          description: "Sort by soonest, latest, or newly created events",
        },
      },
    },
  },
  {
    name: "get_all_events",
    description: "Collect every event that matches the filters (handles pagination automatically)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "All keywords that must appear in the event title / description",
        },
        anyQuery: {
          type: "string",
          description: "Any of these keywords may match (OR search, comma separated is ok)",
        },
        on: {
          description:
            "Specific date(s) like '2024-12-24' or 'today'. Accepts a single string or an array",
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
        },
        from: {
          type: "string",
          description: "Inclusive start date. Natural expressions like 'next Monday' are accepted",
        },
        to: {
          type: "string",
          description: "Inclusive end date for the date range",
        },
        participantNickname: {
          type: "string",
          description: "Limit to events joined by this participant nickname",
        },
        hostNickname: {
          type: "string",
          description: "Filter by the host / organiser nickname",
        },
        groupIds: {
          type: "array",
          items: { type: "number" },
          description: "Only show events from these Connpass group IDs",
        },
        prefectures: {
          description: "Prefecture name(s) to match. Single string or array",
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" }, minItems: 1 },
          ],
        },
        sort: {
          type: "string",
          enum: [...EVENT_SORT_KEYS],
          description: "Sort by soonest, latest, or newly created events",
        },
      },
    },
  },
  {
    name: "get_event_presentations",
    description: "Look up presentation details for a specific event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "integer",
          description: "Connpass event ID (either number or numeric string)",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "get_my_upcoming_events",
    description: "Get today's and upcoming events for the default or specified user",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "integer",
          description: "Connpass user ID to inspect. Falls back to CONNPASS_DEFAULT_USER_ID",
        },
        daysAhead: {
          type: "integer",
          minimum: 1,
          maximum: 60,
          description: "Include events up to this many days ahead (default 7)",
        },
        maxEvents: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum attended events to check (default 30)",
        },
        includePresentations: {
          type: "boolean",
          description:
            "If true, also fetch presentation details for each event (extra API calls, rate-limited)",
        },
      },
    },
  },
];

const eventHandlers = {
  async search_events(args: unknown, connpassClient: ConnpassClient) {
    const params = EventSearchInputSchema.parse(args ?? {});
    const searchParams = buildEventSearchParams(params);
    const response = await connpassClient.searchEvents(searchParams);
    return formatEventsResponse(response, DEFAULT_EVENT_FORMAT_OPTIONS);
  },
  async get_all_events(args: unknown, connpassClient: ConnpassClient) {
    const params = EventSearchInputSchema.parse(args ?? {});
    const searchParams = buildEventSearchParams(params, { includePagination: false });
    const response = await connpassClient.getAllEvents(searchParams);
    return formatEventsResponse(response, DEFAULT_EVENT_FORMAT_OPTIONS);
  },
  async get_event_presentations(args: unknown, connpassClient: ConnpassClient) {
    const { eventId } = EventPresentationsInputSchema.parse(args ?? {});
    const response = await connpassClient.getEventPresentations(eventId);
    return formatPresentationsResponse(response, DEFAULT_EVENT_FORMAT_OPTIONS);
  },
  async get_my_upcoming_events(args: unknown, connpassClient: ConnpassClient) {
    const parsed = MyUpcomingEventsInputSchema.parse(args ?? {});

    const resolvedUserId = parsed.userId ?? getDefaultUserId();
    if (!resolvedUserId) {
      throw new Error(
        "User ID is required. Pass 'userId' or set CONNPASS_DEFAULT_USER_ID in the environment."
      );
    }

    const daysAhead = parsed.daysAhead ?? 7;
    const maxEventsToFetch = parsed.maxEvents ?? 30;
    const includePresentations = parsed.includePresentations ?? getDefaultIncludePresentations();

    const today = startOfDay(new Date());
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + daysAhead);
    rangeEnd.setHours(23, 59, 59, 999);

    const attended = await connpassClient.getUserAttendedEvents(resolvedUserId, {
      count: maxEventsToFetch,
      order: 2,
    });

    const filtered = attended.events
      .filter((event) => {
        const start = new Date(event.startedAt);
        return start >= today && start <= rangeEnd;
      })
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    const todayEvents = filtered.filter((event) => isSameDay(new Date(event.startedAt), today));
    const upcomingEvents = filtered.filter((event) => !isSameDay(new Date(event.startedAt), today));

    const [enrichedToday, enrichedUpcoming] = await Promise.all([
      maybeAttachPresentations(todayEvents, includePresentations, connpassClient),
      maybeAttachPresentations(upcomingEvents, includePresentations, connpassClient),
    ]);

    return {
      userId: resolvedUserId,
      today: {
        date: formatDateLabel(today),
        events: formatEventList(enrichedToday),
      },
      upcoming: {
        rangeEnd: formatDateLabel(rangeEnd),
        events: formatEventList(enrichedUpcoming),
      },
      metadata: {
        inspected: attended.eventsReturned,
        limit: maxEventsToFetch,
        daysAhead,
        includePresentations: Boolean(includePresentations),
      },
    };
  },
};

export type EventToolName = keyof typeof eventHandlers;

export const eventTools = eventToolsInternal;

export function isEventTool(name: string): name is EventToolName {
  return name in eventHandlers;
}

export async function handleEventTool(
  name: EventToolName,
  args: unknown,
  connpassClient: ConnpassClient
) {
  return eventHandlers[name](args, connpassClient);
}
