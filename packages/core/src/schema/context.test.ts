import { describe, it, expect } from "vitest";
import {
  ContextEventSchema,
  PageVisitDataSchema,
  SelectionDataSchema,
  ConversationDataSchema,
  ContextStoreSchema,
  createContextEvent,
  createEmptyContextStore,
  parseContextStore,
  safeParseContextStore,
  ContextEventType,
} from "./context.js";

describe("ContextEventSchema", () => {
  it("validates a complete page_visit event", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "page_visit",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "chrome-extension",
      data: {
        url: "https://example.com/page",
        title: "Example Page",
        hostname: "example.com",
      },
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("validates a selection event", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      type: "selection",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "chrome-extension",
      data: {
        url: "https://example.com",
        text: "Selected text content",
        context: "Surrounding paragraph",
      },
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("validates a conversation event", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      type: "conversation",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "claude-desktop",
      data: {
        summary: "Discussed MCP server implementation",
        topics: ["MCP", "TypeScript", "schemas"],
      },
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("validates an insight event", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440003",
      type: "insight",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "claude-desktop",
      data: {
        insight: "User prefers TypeScript over Python",
        confidence: 0.8,
      },
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects event with invalid type", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "invalid_type",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "chrome-extension",
      data: {},
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with invalid UUID", () => {
    const event = {
      id: "not-a-uuid",
      type: "page_visit",
      timestamp: "2025-12-05T10:00:00.000Z",
      source: "chrome-extension",
      data: {},
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event with invalid timestamp", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "page_visit",
      timestamp: "not-a-date",
      source: "chrome-extension",
      data: {},
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event missing required fields", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "page_visit",
      // missing timestamp, source, data
    };

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("PageVisitDataSchema", () => {
  it("validates complete page visit data", () => {
    const data = {
      url: "https://anthropic.com/jobs/123",
      title: "Software Engineer - Anthropic",
      hostname: "anthropic.com",
      content: "Full page content here...",
      selection: "Selected text",
      pageType: "job-posting",
    };

    const result = PageVisitDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates minimal page visit data", () => {
    const data = {
      url: "https://example.com",
      title: "Example",
      hostname: "example.com",
    };

    const result = PageVisitDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates all pageType enum values", () => {
    const pageTypes = [
      "job-posting",
      "github",
      "stackoverflow",
      "documentation",
      "article",
      "webpage",
    ];

    for (const pageType of pageTypes) {
      const data = {
        url: "https://example.com",
        title: "Example",
        hostname: "example.com",
        pageType,
      };
      const result = PageVisitDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid URL", () => {
    const data = {
      url: "not-a-url",
      title: "Example",
      hostname: "example.com",
    };

    const result = PageVisitDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects invalid pageType", () => {
    const data = {
      url: "https://example.com",
      title: "Example",
      hostname: "example.com",
      pageType: "invalid-type",
    };

    const result = PageVisitDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("SelectionDataSchema", () => {
  it("validates complete selection data", () => {
    const data = {
      url: "https://example.com/article",
      text: "The selected text from the page",
      context: "Surrounding paragraph for context",
    };

    const result = SelectionDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates minimal selection data", () => {
    const data = {
      url: "https://example.com",
      text: "Selected text",
    };

    const result = SelectionDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const data = {
      url: "https://example.com",
      text: "",
    };

    const result = SelectionDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("ConversationDataSchema", () => {
  it("validates complete conversation data", () => {
    const data = {
      summary: "Discussed project architecture",
      topics: ["MCP", "TypeScript", "schemas"],
      messageCount: 10,
    };

    const result = ConversationDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("validates minimal conversation data", () => {
    const data = {
      summary: "Quick chat",
    };

    const result = ConversationDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects empty summary", () => {
    const data = {
      summary: "",
    };

    const result = ConversationDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("ContextStoreSchema", () => {
  it("validates complete context store", () => {
    const store = {
      version: "1.0.0",
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "page_visit",
          timestamp: "2025-12-05T10:00:00.000Z",
          source: "chrome-extension",
          data: {
            url: "https://example.com",
            title: "Example",
            hostname: "example.com",
          },
        },
      ],
    };

    const result = ContextStoreSchema.safeParse(store);
    expect(result.success).toBe(true);
  });

  it("validates empty context store", () => {
    const store = {
      version: "1.0.0",
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [],
    };

    const result = ContextStoreSchema.safeParse(store);
    expect(result.success).toBe(true);
  });

  it("rejects store missing version", () => {
    const store = {
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [],
    };

    const result = ContextStoreSchema.safeParse(store);
    expect(result.success).toBe(false);
  });

  it("rejects store with invalid event", () => {
    const store = {
      version: "1.0.0",
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [{ invalid: "event" }],
    };

    const result = ContextStoreSchema.safeParse(store);
    expect(result.success).toBe(false);
  });
});

describe("createContextEvent", () => {
  it("creates valid page_visit event", () => {
    const event = createContextEvent("page_visit", "chrome-extension", {
      url: "https://example.com",
      title: "Example",
      hostname: "example.com",
    });

    expect(event.type).toBe("page_visit");
    expect(event.source).toBe("chrome-extension");
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("creates valid insight event", () => {
    const event = createContextEvent("insight", "claude-desktop", {
      insight: "User prefers concise responses",
      confidence: 0.9,
    });

    expect(event.type).toBe("insight");
    expect(event.source).toBe("claude-desktop");

    const result = ContextEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("createEmptyContextStore", () => {
  it("creates valid empty store", () => {
    const store = createEmptyContextStore();

    expect(store.version).toBe("1.0.0");
    expect(store.events).toEqual([]);
    expect(store.lastModified).toBeDefined();

    const result = ContextStoreSchema.safeParse(store);
    expect(result.success).toBe(true);
  });
});

describe("parseContextStore", () => {
  it("parses valid store data", () => {
    const data = {
      version: "1.0.0",
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [],
    };

    const store = parseContextStore(data);
    expect(store.version).toBe("1.0.0");
  });

  it("throws on invalid data", () => {
    expect(() => parseContextStore({})).toThrow();
  });
});

describe("safeParseContextStore", () => {
  it("returns store on valid data", () => {
    const data = {
      version: "1.0.0",
      lastModified: "2025-12-05T10:00:00.000Z",
      events: [],
    };

    const result = safeParseContextStore(data);
    expect(result).not.toBeNull();
  });

  it("returns null on invalid data", () => {
    const result = safeParseContextStore({});
    expect(result).toBeNull();
  });
});

describe("ContextEventType", () => {
  it("exports event type enum values", () => {
    expect(ContextEventType.PAGE_VISIT).toBe("page_visit");
    expect(ContextEventType.SELECTION).toBe("selection");
    expect(ContextEventType.CONVERSATION).toBe("conversation");
    expect(ContextEventType.INSIGHT).toBe("insight");
    expect(ContextEventType.FILE).toBe("file");
  });
});
