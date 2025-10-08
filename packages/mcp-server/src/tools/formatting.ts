import type {
  Event,
  EventsResponse,
  Presentation,
  PresentationsResponse,
} from "@kajidog/connpass-api-client";

const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#34;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x60;": "`",
};

export interface FormatEventOptions {
  descriptionLimit?: number;
  catchPhraseLimit?: number;
  presentationDescriptionLimit?: number;
}

export interface FormattedPresentation {
  id: number;
  title: string;
  speaker: string;
  summary?: string;
  links?: {
    url?: string;
    slideshare?: string;
    youtube?: string;
    twitter?: string;
  };
  order: number;
  updatedAt: string;
}

export interface FormattedEvent {
  id: number;
  title: string;
  catchPhrase?: string;
  summary?: string;
  url: string;
  hashTag?: string;
  imageUrl?: string;
  schedule: {
    start: string;
    end: string;
  };
  location?: {
    place?: string;
    address?: string;
  };
  owner: {
    nickname: string;
    displayName: string;
  };
  participants: {
    accepted: number;
    waiting: number;
    limit?: number;
  };
  group?: {
    id?: number;
    title?: string;
    url?: string;
  };
  updatedAt: string;
  presentations?: FormattedPresentation[];
}

export interface FormattedEventsResponse {
  returned: number;
  available: number;
  start: number;
  events: FormattedEvent[];
}

export interface FormattedPresentationsResponse {
  returned: number;
  presentations: FormattedPresentation[];
}

export function truncateText(text: string, limit: number): string {
  if (!text) {
    return "";
  }

  if (text.length <= limit) {
    return text;
  }

  if (limit <= 3) {
    return text.slice(0, limit);
  }

  return `${text.slice(0, limit - 3).trimEnd()}...`;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity) => {
      const mapped = HTML_ENTITY_MAP[entity];
      if (mapped) {
        return mapped;
      }

      const numericMatch = entity.match(/^&#(x?[0-9a-fA-F]+);$/);
      if (!numericMatch) {
        return entity;
      }

      const value = numericMatch[1];
      const codePoint = value.startsWith("x") || value.startsWith("X")
        ? Number.parseInt(value.slice(1), 16)
        : Number.parseInt(value, 10);

      if (!Number.isFinite(codePoint)) {
        return entity;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch (error) {
        return entity;
      }
    })
    .replace(/\u00a0/gi, " ");
}

export function stripHtml(input: string): string {
  if (!input) {
    return "";
  }

  const withoutScripts = input.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, "");

  const withLineBreaks = withoutStyles
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(h[1-6]|tr)>/gi, "\n");

  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags);
}

export function sanitizeRichText(input: string): string {
  if (!input) {
    return "";
  }

  const stripped = stripHtml(input);
  const normalizedWhitespace = stripped
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return normalizedWhitespace.replace(/[\t ]+/g, " ").trim();
}

export function formatPresentation(
  presentation: Presentation,
  descriptionLimit?: number
): FormattedPresentation {
  const summary = sanitizeRichText(presentation.description);

  const formatted: FormattedPresentation = {
    id: presentation.id,
    title: presentation.title.trim(),
    speaker: presentation.speakerName,
    order: presentation.order,
    updatedAt: presentation.updatedAt,
  };

  const processedSummary =
    typeof descriptionLimit === "number" && descriptionLimit > 0
      ? truncateText(summary, descriptionLimit)
      : summary;

  if (processedSummary) {
    formatted.summary = processedSummary;
  }

  const links: FormattedPresentation["links"] = {
    url: presentation.url,
    slideshare: presentation.slideshareUrl,
    youtube: presentation.youtubeUrl,
    twitter: presentation.twitterUrl,
  };

  if (links.url || links.slideshare || links.youtube || links.twitter) {
    formatted.links = links;
  }

  return formatted;
}

export function formatPresentationsResponse(
  response: PresentationsResponse,
  options?: Pick<FormatEventOptions, "presentationDescriptionLimit">
): FormattedPresentationsResponse {
  const descriptionLimit = options?.presentationDescriptionLimit;

  return {
    returned: response.presentationsReturned,
    presentations: response.presentations.map((presentation) =>
      formatPresentation(presentation, descriptionLimit)
    ),
  };
}

export function formatEvent(event: Event, options?: FormatEventOptions): FormattedEvent {
  const descriptionLimit = options?.descriptionLimit;
  const catchPhraseLimit = options?.catchPhraseLimit;
  const presentationDescriptionLimit = options?.presentationDescriptionLimit;

  const catchPhrase = sanitizeRichText(event.catchPhrase);
  const description = sanitizeRichText(event.description);

  const participants: FormattedEvent["participants"] = {
    accepted: event.participantCount,
    waiting: event.waitingCount,
  };

  if (typeof event.limit === "number") {
    participants.limit = event.limit;
  }

  const formatted: FormattedEvent = {
    id: event.id,
    title: event.title.trim(),
    url: event.url,
    schedule: {
      start: event.startedAt,
      end: event.endedAt,
    },
    owner: {
      nickname: event.ownerNickname,
      displayName: event.ownerDisplayName,
    },
    participants,
    updatedAt: event.updatedAt,
  };

  if (event.hashTag) {
    formatted.hashTag = event.hashTag;
  }

  if (event.imageUrl) {
    formatted.imageUrl = event.imageUrl;
  }

  const processedCatchPhrase =
    typeof catchPhraseLimit === "number" && catchPhraseLimit > 0
      ? truncateText(catchPhrase, catchPhraseLimit)
      : catchPhrase;
  if (processedCatchPhrase) {
    formatted.catchPhrase = processedCatchPhrase;
  }

  const processedDescription =
    typeof descriptionLimit === "number" && descriptionLimit > 0
      ? truncateText(description, descriptionLimit)
      : description;
  if (processedDescription) {
    formatted.summary = processedDescription;
  }

  if (event.place || event.address) {
    const location: FormattedEvent["location"] = {};
    if (event.place) {
      location.place = event.place;
    }
    if (event.address) {
      location.address = event.address;
    }

    if (Object.keys(location).length > 0) {
      formatted.location = location;
    }
  }

  if (event.groupId || event.groupTitle || event.groupUrl) {
    const group: FormattedEvent["group"] = {};
    if (typeof event.groupId === "number") {
      group.id = event.groupId;
    }
    if (event.groupTitle) {
      group.title = event.groupTitle;
    }
    if (event.groupUrl) {
      group.url = event.groupUrl;
    }

    if (Object.keys(group).length > 0) {
      formatted.group = group;
    }
  }

  const eventWithPresentations = event as Event & {
    presentations?: PresentationsResponse["presentations"];
  };

  if (eventWithPresentations.presentations?.length) {
    formatted.presentations = eventWithPresentations.presentations.map((presentation) =>
      formatPresentation(presentation, presentationDescriptionLimit)
    );
  }

  return formatted;
}

export function formatEventsResponse(
  response: EventsResponse,
  options?: FormatEventOptions
): FormattedEventsResponse {
  return {
    returned: response.eventsReturned,
    available: response.eventsAvailable,
    start: response.eventsStart,
    events: response.events.map((event) => formatEvent(event, options)),
  };
}

export function formatEventList(
  events: (Event & { presentations?: PresentationsResponse["presentations"] })[],
  options?: FormatEventOptions
): FormattedEvent[] {
  return events.map((event) => formatEvent(event, options));
}
