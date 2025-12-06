/**
 * Context CLI Operations
 *
 * Manages ~/.arete/context.json - the local context store.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  createEmptyContextStore,
  createContextEvent,
  safeParseContextStore,
  type ContextStore,
  type ContextEvent,
  type ContextEventTypeValue,
} from "../schema/context.js";

// Constants
const MAX_EVENTS = 100;

// Configurable directory (for testing)
let CONFIG_DIR = join(homedir(), ".arete");

export function setConfigDir(dir: string): void {
  CONFIG_DIR = dir;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getContextFile(): string {
  return join(CONFIG_DIR, "context.json");
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load context store from disk.
 * Returns empty store if file doesn't exist or is invalid.
 */
export function loadContextStore(): ContextStore {
  ensureConfigDir();

  const contextFile = getContextFile();
  if (!existsSync(contextFile)) {
    return createEmptyContextStore();
  }

  try {
    const data = readFileSync(contextFile, "utf-8");
    const parsed = safeParseContextStore(JSON.parse(data));
    if (parsed) {
      return parsed;
    }
    // Invalid schema, return empty store
    return createEmptyContextStore();
  } catch {
    // Parse error, return empty store
    return createEmptyContextStore();
  }
}

/**
 * Save context store to disk.
 * Updates lastModified timestamp.
 */
export function saveContextStore(store: ContextStore): void {
  ensureConfigDir();

  // Update timestamp
  store.lastModified = new Date().toISOString();

  writeFileSync(getContextFile(), JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

/**
 * Add a new context event.
 * Enforces max events limit by removing oldest events.
 */
export function addContextEvent(
  type: ContextEventTypeValue,
  source: string,
  data: Record<string, unknown>
): ContextEvent {
  const store = loadContextStore();
  const event = createContextEvent(type, source, data);

  store.events.push(event);

  // Prune oldest events if over limit
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(store.events.length - MAX_EVENTS);
  }

  saveContextStore(store);
  return event;
}

/**
 * Clear all context events.
 */
export function clearContextStore(): void {
  const store = createEmptyContextStore();
  saveContextStore(store);
}

/**
 * Options for listing context events.
 */
export interface ListContextOptions {
  type?: string;
  source?: string;
  limit?: number;
  since?: string; // ISO timestamp
}

/**
 * List context events with optional filtering.
 * Returns events in reverse chronological order (newest first).
 */
export function listContextEvents(options: ListContextOptions = {}): ContextEvent[] {
  const store = loadContextStore();
  let events = [...store.events];

  // Filter by type
  if (options.type) {
    events = events.filter((e) => e.type === options.type);
  }

  // Filter by source
  if (options.source) {
    events = events.filter((e) => e.source === options.source);
  }

  // Filter by time
  if (options.since) {
    const sinceTime = new Date(options.since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
  }

  // Sort by timestamp descending (newest first)
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Apply limit
  if (options.limit && options.limit > 0) {
    events = events.slice(0, options.limit);
  }

  return events;
}

/**
 * Format a single context event for display.
 */
export function formatContextEvent(event: ContextEvent): string {
  const time = new Date(event.timestamp).toLocaleString();
  const lines: string[] = [];

  lines.push(`[${time}] ${event.type} (${event.source})`);

  switch (event.type) {
    case "page_visit": {
      const data = event.data as { url?: string; title?: string };
      if (data.title) lines.push(`  Title: ${data.title}`);
      if (data.url) lines.push(`  URL: ${data.url}`);
      break;
    }
    case "selection": {
      const data = event.data as { text?: string; url?: string };
      if (data.text) {
        const preview = data.text.length > 100 ? data.text.slice(0, 100) + "..." : data.text;
        lines.push(`  Text: "${preview}"`);
      }
      if (data.url) lines.push(`  From: ${data.url}`);
      break;
    }
    case "conversation": {
      const data = event.data as { summary?: string; topics?: string[] };
      if (data.summary) lines.push(`  Summary: ${data.summary}`);
      if (data.topics?.length) lines.push(`  Topics: ${data.topics.join(", ")}`);
      break;
    }
    case "insight": {
      const data = event.data as { insight?: string; confidence?: number };
      if (data.insight) lines.push(`  Insight: ${data.insight}`);
      if (data.confidence !== undefined) {
        lines.push(`  Confidence: ${Math.round(data.confidence * 100)}%`);
      }
      break;
    }
    case "file": {
      const data = event.data as { path?: string; name?: string };
      if (data.name) lines.push(`  File: ${data.name}`);
      if (data.path) lines.push(`  Path: ${data.path}`);
      break;
    }
    default: {
      // Generic fallback
      lines.push(`  Data: ${JSON.stringify(event.data)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format multiple events for display.
 */
export function formatContextList(events: ContextEvent[]): string {
  if (events.length === 0) {
    return "No context events.";
  }

  return events.map(formatContextEvent).join("\n\n");
}

/**
 * Extension export format (from Chrome extension popup).
 */
export interface ExtensionExport {
  version: string;
  exportedAt: string;
  source: string;
  data: {
    context_pages?: Array<{
      url: string;
      title: string;
      hostname: string;
      timestamp: number;
    }>;
    facts_learned?: Array<{
      fact: string;
      confidence?: number;
      _timestamp?: number;
    }>;
    conversation?: unknown[];
    identity?: unknown;
  };
}

/**
 * Result of import operation.
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Import context from Chrome extension export file.
 * Converts extension format to ContextEvent format.
 */
export async function importFromExtension(filePath: string): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
  };

  // Check file exists
  if (!existsSync(filePath)) {
    result.errors.push(`File not found: ${filePath}`);
    return result;
  }

  // Parse export file
  let exportData: ExtensionExport;
  try {
    const content = readFileSync(filePath, "utf-8");
    exportData = JSON.parse(content) as ExtensionExport;
  } catch (err) {
    result.errors.push(`Failed to parse export file: ${err instanceof Error ? err.message : "Unknown error"}`);
    return result;
  }

  // Load existing store to check for duplicates
  const store = loadContextStore();
  const existingUrls = new Set(
    store.events
      .filter((e) => e.type === "page_visit")
      .map((e) => (e.data as { url?: string }).url)
      .filter(Boolean)
  );

  // Import page visits (preserve original timestamps)
  if (exportData.data.context_pages) {
    for (const page of exportData.data.context_pages) {
      // Skip duplicates
      if (existingUrls.has(page.url)) {
        result.skipped++;
        continue;
      }

      // Create event with original timestamp
      const event = createContextEvent("page_visit", "chrome-extension", {
        url: page.url,
        title: page.title,
        hostname: page.hostname,
      });
      // Override timestamp with original from export
      if (page.timestamp) {
        event.timestamp = new Date(page.timestamp).toISOString();
      }
      store.events.push(event);
      result.imported++;
      existingUrls.add(page.url);
    }
  }

  // Import facts as insights (preserve original timestamps)
  if (exportData.data.facts_learned) {
    for (const fact of exportData.data.facts_learned) {
      const event = createContextEvent("insight", "chrome-extension", {
        insight: fact.fact,
        confidence: fact.confidence,
      });
      // Override timestamp with original from export
      if (fact._timestamp) {
        event.timestamp = new Date(fact._timestamp).toISOString();
      }
      store.events.push(event);
      result.imported++;
    }
  }

  // Save updated store
  if (result.imported > 0) {
    saveContextStore(store);
  }

  return result;
}
