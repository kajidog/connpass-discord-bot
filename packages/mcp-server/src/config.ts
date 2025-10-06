const RAW_DEFAULT_USER_ID = process.env.CONNPASS_DEFAULT_USER_ID;
const RAW_INCLUDE_PRESENTATIONS_DEFAULT = process.env.CONNPASS_INCLUDE_PRESENTATIONS_DEFAULT;

const parsedDefaultUserId = (() => {
  if (!RAW_DEFAULT_USER_ID) {
    return undefined;
  }

  const numeric = Number(RAW_DEFAULT_USER_ID);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    console.warn(
      "[mcp-server] CONNPASS_DEFAULT_USER_ID is set but not a positive number. It will be ignored."
    );
    return undefined;
  }

  return Math.trunc(numeric);
})();

const parsedIncludePresentationsDefault = (() => {
  if (!RAW_INCLUDE_PRESENTATIONS_DEFAULT) {
    return undefined;
  }

  const normalized = RAW_INCLUDE_PRESENTATIONS_DEFAULT.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  console.warn(
    "[mcp-server] CONNPASS_INCLUDE_PRESENTATIONS_DEFAULT is set but not a recognizable boolean. It will be ignored."
  );
  return undefined;
})();

export function getDefaultUserId(): number | undefined {
  return parsedDefaultUserId;
}

export function getDefaultIncludePresentations(): boolean | undefined {
  return parsedIncludePresentationsDefault;
}
