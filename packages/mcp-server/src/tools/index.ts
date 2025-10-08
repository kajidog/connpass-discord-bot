import { ConnpassClient } from "@kajidog/connpass-api-client";

import { eventTools, handleEventTool, isEventTool } from "./events.js";
import { groupTools, handleGroupTool, isGroupTool } from "./groups.js";
import { userTools, handleUserTool, isUserTool } from "./users.js";

export const tools = [...eventTools, ...groupTools, ...userTools];

export async function handleToolCall(name: string, args: unknown, connpassClient: ConnpassClient) {
  if (isEventTool(name)) {
    return handleEventTool(name, args, connpassClient);
  }

  if (isGroupTool(name)) {
    return handleGroupTool(name, args, connpassClient);
  }

  if (isUserTool(name)) {
    return handleUserTool(name, args, connpassClient);
  }

  throw new Error(`Unknown tool: ${name}`);
}
