export const DEFAULT_PAGE_SIZE = 20;

export const EVENT_SORT_KEYS = [
  "start-date-asc",
  "start-date-desc",
  "newly-added",
] as const;
export type EventSortKey = (typeof EVENT_SORT_KEYS)[number];
export const EVENT_SORT_MAP: Record<EventSortKey, 1 | 2 | 3> = {
  "start-date-asc": 1,
  "start-date-desc": 2,
  "newly-added": 3,
};

export const GROUP_SORT_KEYS = [
  "most-events",
  "most-members",
  "newly-added",
] as const;
export type GroupSortKey = (typeof GROUP_SORT_KEYS)[number];
export const GROUP_SORT_MAP: Record<GroupSortKey, 1 | 2 | 3> = {
  "most-events": 1,
  "most-members": 2,
  "newly-added": 3,
};

export const USER_SORT_KEYS = [
  "most-events",
  "most-followers",
  "newly-added",
] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];
export const USER_SORT_MAP: Record<UserSortKey, 1 | 2 | 3> = {
  "most-events": 1,
  "most-followers": 2,
  "newly-added": 3,
};

const RELATIVE_DATE_KEYWORDS: Record<string, () => Date> = {
  today: () => new Date(),
  tomorrow: () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  },
  yesterday: () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  },
};

function formatAsYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function parseDateInput(input: string): string {
  const normalized = input.trim().toLowerCase();
  const relativeFactory = RELATIVE_DATE_KEYWORDS[normalized];
  if (relativeFactory) {
    return formatAsYmd(relativeFactory());
  }

  const hyphenFree = normalized.replace(/[-/.]/g, "");
  if (/^\d{8}$/.test(hyphenFree)) {
    const year = Number(hyphenFree.slice(0, 4));
    const month = Number(hyphenFree.slice(4, 6)) - 1;
    const day = Number(hyphenFree.slice(6, 8));
    const candidate = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(candidate.getTime())) {
      return formatAsYmd(candidate);
    }
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return formatAsYmd(parsed);
  }

  throw new Error(`Could not understand date input: ${input}`);
}

export function toYmdArray(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const inputs = Array.isArray(value) ? value : [value];
  return inputs.map((item) => parseDateInput(item));
}

export function normalizeStringArray(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value : [value];
}

export type PaginationParams = { start?: number; count?: number };

export function applyPagination(
  page: number | undefined,
  pageSize: number | undefined,
  options?: { includePagination?: boolean }
): PaginationParams {
  const includePagination = options?.includePagination ?? true;
  if (!includePagination) {
    return {};
  }

  const effectivePageSize = pageSize ?? DEFAULT_PAGE_SIZE;
  const pagination: PaginationParams = {};

  if (page) {
    pagination.start = 1 + (page - 1) * effectivePageSize;
    pagination.count = effectivePageSize;
  } else if (pageSize) {
    pagination.count = effectivePageSize;
  }

  return pagination;
}
