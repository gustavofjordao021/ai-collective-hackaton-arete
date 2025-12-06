/**
 * arete_get_recent_context and arete_add_context_event MCP tools
 *
 * Reads/writes ~/.arete/context.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  safeParseContextStore,
  createEmptyContextStore,
  createContextEvent,
  ContextEventType,
  type ContextStore,
  type ContextEvent,
  type ContextEventTypeValue,
} from "@arete/core";

// Constants
const MAX_EVENTS = 100;
const VALID_EVENT_TYPES = Object.values(ContextEventType);

// Configurable directory (for testing)
let CONFIG_DIR = join(homedir(), ".arete");

export function setConfigDir(dir: string): void {
  CONFIG_DIR = dir;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

function getContextFile(): string {
  return join(CONFIG_DIR, "context.json");
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadContextStore(): ContextStore {
  ensureConfigDir();
  const contextFile = getContextFile();

  if (!existsSync(contextFile)) {
    return createEmptyContextStore();
  }

  try {
    const data = readFileSync(contextFile, "utf-8");
    const parsed = safeParseContextStore(JSON.parse(data));
    return parsed || createEmptyContextStore();
  } catch {
    return createEmptyContextStore();
  }
}

function saveContextStore(store: ContextStore): void {
  ensureConfigDir();
  store.lastModified = new Date().toISOString();
  writeFileSync(getContextFile(), JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

// --- arete_get_recent_context ---

export interface GetContextInput {
  type?: string;
  source?: string;
  limit?: number;
  since?: string;
}

export interface GetContextOutput {
  events: ContextEvent[];
  count: number;
}

export interface ToolResult<T> {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
}

export async function getContextHandler(
  input: GetContextInput
): Promise<ToolResult<GetContextOutput>> {
  const store = loadContextStore();
  let events = [...store.events];

  // Filter by type
  if (input.type) {
    events = events.filter((e) => e.type === input.type);
  }

  // Filter by source
  if (input.source) {
    events = events.filter((e) => e.source === input.source);
  }

  // Filter by time
  if (input.since) {
    const sinceTime = new Date(input.since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
  }

  // Sort by timestamp descending (newest first)
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply limit
  if (input.limit && input.limit > 0) {
    events = events.slice(0, input.limit);
  }

  const output: GetContextOutput = {
    events,
    count: events.length,
  };

  const text =
    events.length === 0
      ? "No context events."
      : `Found ${events.length} context event(s).`;

  return {
    content: [{ type: "text", text }],
    structuredContent: output,
  };
}

// --- arete_add_context_event ---

export interface AddContextEventInput {
  type: string;
  source?: string;
  data: Record<string, unknown>;
}

export interface AddContextEventOutput {
  success: boolean;
  event?: ContextEvent;
  error?: string;
}

export async function addContextEventHandler(
  input: AddContextEventInput
): Promise<ToolResult<AddContextEventOutput>> {
  // Validate event type
  if (!VALID_EVENT_TYPES.includes(input.type as ContextEventTypeValue)) {
    const output: AddContextEventOutput = {
      success: false,
      error: `Invalid event type: ${input.type}. Valid types: ${VALID_EVENT_TYPES.join(", ")}`,
    };
    return {
      content: [{ type: "text", text: `Error: ${output.error}` }],
      structuredContent: output,
    };
  }

  const store = loadContextStore();
  const source = input.source || "claude-desktop";
  const event = createContextEvent(
    input.type as ContextEventTypeValue,
    source,
    input.data
  );

  store.events.push(event);

  // Prune oldest events if over limit
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(store.events.length - MAX_EVENTS);
  }

  saveContextStore(store);

  const output: AddContextEventOutput = {
    success: true,
    event,
  };

  return {
    content: [{ type: "text", text: `Added ${input.type} event.` }],
    structuredContent: output,
  };
}
