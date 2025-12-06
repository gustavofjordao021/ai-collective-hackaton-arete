import { z } from "zod";

// Event type enum for type safety
export const ContextEventType = {
  PAGE_VISIT: "page_visit",
  SELECTION: "selection",
  CONVERSATION: "conversation",
  INSIGHT: "insight",
  FILE: "file",
} as const;

export type ContextEventTypeValue =
  (typeof ContextEventType)[keyof typeof ContextEventType];

// Page types for categorizing web pages
export const PageType = {
  JOB_POSTING: "job-posting",
  GITHUB: "github",
  STACKOVERFLOW: "stackoverflow",
  DOCUMENTATION: "documentation",
  ARTICLE: "article",
  WEBPAGE: "webpage",
} as const;

// Data schemas for specific event types
export const PageVisitDataSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  hostname: z.string(),
  content: z.string().optional(),
  selection: z.string().optional(),
  pageType: z
    .enum([
      "job-posting",
      "github",
      "stackoverflow",
      "documentation",
      "article",
      "webpage",
    ])
    .optional(),
});

export const SelectionDataSchema = z.object({
  url: z.string().url(),
  text: z.string().min(1, "Selection text cannot be empty"),
  context: z.string().optional(),
});

export const ConversationDataSchema = z.object({
  summary: z.string().min(1, "Conversation summary cannot be empty"),
  topics: z.array(z.string()).optional(),
  messageCount: z.number().int().positive().optional(),
});

export const InsightDataSchema = z.object({
  insight: z.string().min(1, "Insight cannot be empty"),
  confidence: z.number().min(0).max(1).optional(),
  relatedEvents: z.array(z.string().uuid()).optional(),
});

export const FileDataSchema = z.object({
  path: z.string(),
  name: z.string(),
  content: z.string().optional(),
  language: z.string().optional(),
});

// Generic context event schema
export const ContextEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["page_visit", "selection", "conversation", "insight", "file"]),
  timestamp: z.string().datetime(),
  source: z.string(), // "chrome-extension", "cli", "claude-desktop", etc.
  data: z.record(z.any()), // Type-specific payload validated separately
});

// Context store schema (the file format for ~/.arete/context.json)
export const ContextStoreSchema = z.object({
  version: z.string(),
  lastModified: z.string().datetime(),
  events: z.array(ContextEventSchema),
});

// Type exports
export type PageVisitData = z.infer<typeof PageVisitDataSchema>;
export type SelectionData = z.infer<typeof SelectionDataSchema>;
export type ConversationData = z.infer<typeof ConversationDataSchema>;
export type InsightData = z.infer<typeof InsightDataSchema>;
export type FileData = z.infer<typeof FileDataSchema>;
export type ContextEvent = z.infer<typeof ContextEventSchema>;
export type ContextStore = z.infer<typeof ContextStoreSchema>;

// Helper functions
export function createContextEvent(
  type: ContextEventTypeValue,
  source: string,
  data: Record<string, unknown>
): ContextEvent {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    source,
    data,
  };
}

export function createEmptyContextStore(): ContextStore {
  return {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    events: [],
  };
}

export function parseContextStore(data: unknown): ContextStore {
  return ContextStoreSchema.parse(data);
}

export function safeParseContextStore(data: unknown): ContextStore | null {
  const result = ContextStoreSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function parseContextEvent(data: unknown): ContextEvent {
  return ContextEventSchema.parse(data);
}

export function safeParseContextEvent(data: unknown): ContextEvent | null {
  const result = ContextEventSchema.safeParse(data);
  return result.success ? result.data : null;
}
