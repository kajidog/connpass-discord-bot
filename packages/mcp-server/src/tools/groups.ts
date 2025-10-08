import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ConnpassClient } from "@kajidog/connpass-api-client";

import { applyPagination, GROUP_SORT_KEYS, GROUP_SORT_MAP, GroupSortKey } from "./shared.js";

const GroupSearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search for groups whose title or description matches all keywords")
    .optional(),
  groupIds: z
    .array(z.number())
    .describe("Limit results to these group IDs")
    .optional(),
  country: z
    .string()
    .min(1)
    .describe("ISO country code, e.g. 'JP'")
    .optional(),
  prefecture: z
    .string()
    .min(1)
    .describe("Prefecture name to filter by")
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
    .describe("How many groups per page (default 20)")
    .optional(),
  sort: z
    .enum(GROUP_SORT_KEYS)
    .describe("Ranking by activity, members, or recency")
    .optional(),
});

type GroupSearchInput = z.infer<typeof GroupSearchInputSchema>;

function buildGroupSearchParams(
  input: GroupSearchInput,
  options?: { includePagination?: boolean }
) {
  const pagination = applyPagination(input.page, input.pageSize, options);
  return {
    keyword: input.query,
    groupId: input.groupIds,
    countryCode: input.country,
    prefecture: input.prefecture,
    order: input.sort ? GROUP_SORT_MAP[input.sort] : undefined,
    ...pagination,
  };
}

const groupToolsInternal: Tool[] = [
  {
    name: "search_groups",
    description: "Find Connpass groups with simple filters",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords that must match the group title or description",
        },
        groupIds: {
          type: "array",
          items: { type: "number" },
          description: "Only show these specific group IDs",
        },
        country: {
          type: "string",
          description: "ISO country code, e.g. 'JP'",
        },
        prefecture: {
          type: "string",
          description: "Prefecture name to filter by",
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
          description: "Groups per page (default 20)",
        },
        sort: {
          type: "string",
          enum: [...GROUP_SORT_KEYS],
          description: "Rank by activity, member count, or recency",
        },
      },
    },
  },
  {
    name: "get_all_groups",
    description: "Collect every group that matches the filters (auto pagination)",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords that must match the group title or description",
        },
        groupIds: {
          type: "array",
          items: { type: "number" },
          description: "Only show these specific group IDs",
        },
        country: {
          type: "string",
          description: "ISO country code, e.g. 'JP'",
        },
        prefecture: {
          type: "string",
          description: "Prefecture name to filter by",
        },
        sort: {
          type: "string",
          enum: [...GROUP_SORT_KEYS],
          description: "Rank by activity, member count, or recency",
        },
      },
    },
  },
];

const groupHandlers = {
  async search_groups(args: unknown, connpassClient: ConnpassClient) {
    const params = GroupSearchInputSchema.parse(args ?? {});
    const searchParams = buildGroupSearchParams(params);
    return connpassClient.searchGroups(searchParams);
  },
  async get_all_groups(args: unknown, connpassClient: ConnpassClient) {
    const params = GroupSearchInputSchema.parse(args ?? {});
    const searchParams = buildGroupSearchParams(params, { includePagination: false });
    return connpassClient.getAllGroups(searchParams);
  },
};

export type GroupToolName = keyof typeof groupHandlers;

export const groupTools = groupToolsInternal;

export function isGroupTool(name: string): name is GroupToolName {
  return name in groupHandlers;
}

export async function handleGroupTool(
  name: GroupToolName,
  args: unknown,
  connpassClient: ConnpassClient
) {
  return groupHandlers[name](args, connpassClient);
}
