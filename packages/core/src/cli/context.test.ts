import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadContextStore,
  saveContextStore,
  addContextEvent,
  clearContextStore,
  listContextEvents,
  getContextFile,
  setConfigDir,
  importFromExtension,
  type ListContextOptions,
} from "./context.js";
import {
  createEmptyContextStore,
  createContextEvent,
  ContextEventType,
} from "../schema/context.js";

// Use a temp directory for tests
const TEST_DIR = join(tmpdir(), "arete-test-" + Date.now());

describe("Context CLI Operations", () => {
  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    setConfigDir(TEST_DIR);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("getContextFile", () => {
    it("returns path to context.json in config dir", () => {
      const path = getContextFile();
      expect(path).toBe(join(TEST_DIR, "context.json"));
    });
  });

  describe("loadContextStore", () => {
    it("returns empty store when file does not exist", () => {
      const store = loadContextStore();
      expect(store.version).toBe("1.0.0");
      expect(store.events).toEqual([]);
    });

    it("loads existing valid store", () => {
      const existingStore = createEmptyContextStore();
      existingStore.events.push(
        createContextEvent(ContextEventType.PAGE_VISIT, "test", {
          url: "https://example.com",
          title: "Test",
          hostname: "example.com",
        })
      );

      writeFileSync(
        join(TEST_DIR, "context.json"),
        JSON.stringify(existingStore, null, 2)
      );

      const loaded = loadContextStore();
      expect(loaded.events.length).toBe(1);
      expect(loaded.events[0].type).toBe("page_visit");
    });

    it("returns empty store on invalid JSON", () => {
      writeFileSync(join(TEST_DIR, "context.json"), "not json");

      const store = loadContextStore();
      expect(store.events).toEqual([]);
    });

    it("returns empty store on invalid schema", () => {
      writeFileSync(
        join(TEST_DIR, "context.json"),
        JSON.stringify({ invalid: "data" })
      );

      const store = loadContextStore();
      expect(store.events).toEqual([]);
    });
  });

  describe("saveContextStore", () => {
    it("creates config directory if not exists", () => {
      rmSync(TEST_DIR, { recursive: true });

      const store = createEmptyContextStore();
      saveContextStore(store);

      expect(existsSync(TEST_DIR)).toBe(true);
      expect(existsSync(join(TEST_DIR, "context.json"))).toBe(true);
    });

    it("writes store to file as pretty JSON", () => {
      const store = createEmptyContextStore();
      store.events.push(
        createContextEvent(ContextEventType.INSIGHT, "cli", {
          insight: "Test insight",
        })
      );

      saveContextStore(store);

      const content = readFileSync(join(TEST_DIR, "context.json"), "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.events.length).toBe(1);
      expect(parsed.events[0].data.insight).toBe("Test insight");
    });

    it("updates lastModified timestamp", async () => {
      const store = createEmptyContextStore();
      const originalTime = store.lastModified;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));
      saveContextStore(store);

      const loaded = loadContextStore();
      expect(loaded.lastModified).not.toBe(originalTime);
    });
  });

  describe("addContextEvent", () => {
    it("adds event to empty store", () => {
      addContextEvent(ContextEventType.PAGE_VISIT, "chrome-extension", {
        url: "https://anthropic.com",
        title: "Anthropic",
        hostname: "anthropic.com",
      });

      const store = loadContextStore();
      expect(store.events.length).toBe(1);
      expect(store.events[0].type).toBe("page_visit");
      expect(store.events[0].source).toBe("chrome-extension");
    });

    it("appends event to existing store", () => {
      // Add first event
      addContextEvent(ContextEventType.PAGE_VISIT, "test", {
        url: "https://example.com",
        title: "First",
        hostname: "example.com",
      });

      // Add second event
      addContextEvent(ContextEventType.SELECTION, "test", {
        url: "https://example.com",
        text: "Selected text",
      });

      const store = loadContextStore();
      expect(store.events.length).toBe(2);
      expect(store.events[0].type).toBe("page_visit");
      expect(store.events[1].type).toBe("selection");
    });

    it("returns the created event", () => {
      const event = addContextEvent(ContextEventType.INSIGHT, "cli", {
        insight: "User prefers TypeScript",
        confidence: 0.9,
      });

      expect(event.type).toBe("insight");
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it("respects max events limit", () => {
      const MAX_EVENTS = 100;

      // Add more than max events
      for (let i = 0; i < MAX_EVENTS + 10; i++) {
        addContextEvent(ContextEventType.PAGE_VISIT, "test", {
          url: `https://example.com/${i}`,
          title: `Page ${i}`,
          hostname: "example.com",
        });
      }

      const store = loadContextStore();
      expect(store.events.length).toBeLessThanOrEqual(MAX_EVENTS);
      // Oldest events should be pruned (first pages)
      expect(store.events[0].data.url).not.toBe("https://example.com/0");
    });
  });

  describe("clearContextStore", () => {
    it("removes all events", () => {
      // Add some events
      addContextEvent(ContextEventType.PAGE_VISIT, "test", {
        url: "https://example.com",
        title: "Test",
        hostname: "example.com",
      });
      addContextEvent(ContextEventType.INSIGHT, "test", {
        insight: "Test",
      });

      expect(loadContextStore().events.length).toBe(2);

      clearContextStore();

      const store = loadContextStore();
      expect(store.events.length).toBe(0);
      expect(store.version).toBe("1.0.0"); // Store still valid
    });

    it("works on empty store", () => {
      clearContextStore();
      const store = loadContextStore();
      expect(store.events.length).toBe(0);
    });
  });

  describe("listContextEvents", () => {
    beforeEach(() => {
      // Add variety of events for testing
      addContextEvent(ContextEventType.PAGE_VISIT, "chrome", {
        url: "https://github.com",
        title: "GitHub",
        hostname: "github.com",
      });
      addContextEvent(ContextEventType.SELECTION, "chrome", {
        url: "https://github.com",
        text: "Selected code",
      });
      addContextEvent(ContextEventType.PAGE_VISIT, "chrome", {
        url: "https://anthropic.com",
        title: "Anthropic",
        hostname: "anthropic.com",
      });
      addContextEvent(ContextEventType.INSIGHT, "claude-desktop", {
        insight: "User interested in AI",
        confidence: 0.8,
      });
    });

    it("returns all events by default", () => {
      const events = listContextEvents();
      expect(events.length).toBe(4);
    });

    it("filters by type", () => {
      const pageVisits = listContextEvents({ type: "page_visit" });
      expect(pageVisits.length).toBe(2);
      expect(pageVisits.every((e) => e.type === "page_visit")).toBe(true);
    });

    it("filters by source", () => {
      const chromeEvents = listContextEvents({ source: "chrome" });
      expect(chromeEvents.length).toBe(3);

      const claudeEvents = listContextEvents({ source: "claude-desktop" });
      expect(claudeEvents.length).toBe(1);
    });

    it("respects limit", () => {
      const limited = listContextEvents({ limit: 2 });
      expect(limited.length).toBe(2);
    });

    it("returns most recent first", () => {
      const events = listContextEvents();
      // Events should be in reverse chronological order (newest first)
      for (let i = 0; i < events.length - 1; i++) {
        expect(new Date(events[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i + 1].timestamp).getTime()
        );
      }
    });

    it("combines multiple filters", () => {
      const filtered = listContextEvents({
        type: "page_visit",
        source: "chrome",
        limit: 1,
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe("page_visit");
      expect(filtered[0].source).toBe("chrome");
    });

    it("returns empty array when no matches", () => {
      const events = listContextEvents({ type: "file" });
      expect(events).toEqual([]);
    });
  });

  describe("importFromExtension", () => {
    it("imports page visits from extension export", async () => {
      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        source: "chrome-extension",
        data: {
          context_pages: [
            {
              url: "https://github.com/anthropics/claude-code",
              title: "Claude Code",
              hostname: "github.com",
              timestamp: Date.now() - 1000,
            },
            {
              url: "https://docs.anthropic.com",
              title: "Anthropic Docs",
              hostname: "docs.anthropic.com",
              timestamp: Date.now(),
            },
          ],
        },
      };

      writeFileSync(
        join(TEST_DIR, "export.json"),
        JSON.stringify(exportData, null, 2)
      );

      const result = await importFromExtension(join(TEST_DIR, "export.json"));

      expect(result.imported).toBe(2);
      expect(result.errors).toEqual([]);

      const events = listContextEvents({ type: "page_visit" });
      expect(events.length).toBe(2);
      expect(events[0].data.hostname).toBe("docs.anthropic.com");
    });

    it("skips duplicate URLs", async () => {
      // Add existing event
      addContextEvent("page_visit", "chrome-extension", {
        url: "https://github.com",
        title: "GitHub",
        hostname: "github.com",
      });

      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        source: "chrome-extension",
        data: {
          context_pages: [
            {
              url: "https://github.com",
              title: "GitHub Updated",
              hostname: "github.com",
              timestamp: Date.now(),
            },
            {
              url: "https://new-site.com",
              title: "New Site",
              hostname: "new-site.com",
              timestamp: Date.now(),
            },
          ],
        },
      };

      writeFileSync(
        join(TEST_DIR, "export.json"),
        JSON.stringify(exportData, null, 2)
      );

      const result = await importFromExtension(join(TEST_DIR, "export.json"));

      expect(result.imported).toBe(1); // Only new-site.com
      expect(result.skipped).toBe(1); // github.com skipped

      const events = listContextEvents({ type: "page_visit" });
      expect(events.length).toBe(2);
    });

    it("handles invalid export file gracefully", async () => {
      writeFileSync(join(TEST_DIR, "invalid.json"), "not json");

      const result = await importFromExtension(join(TEST_DIR, "invalid.json"));

      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("handles missing file gracefully", async () => {
      const result = await importFromExtension(
        join(TEST_DIR, "nonexistent.json")
      );

      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("imports facts as insights", async () => {
      const exportData = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        source: "chrome-extension",
        data: {
          facts_learned: [
            {
              fact: "User prefers TypeScript",
              confidence: 0.9,
              _timestamp: Date.now(),
            },
          ],
        },
      };

      writeFileSync(
        join(TEST_DIR, "export.json"),
        JSON.stringify(exportData, null, 2)
      );

      const result = await importFromExtension(join(TEST_DIR, "export.json"));

      expect(result.imported).toBe(1);

      const insights = listContextEvents({ type: "insight" });
      expect(insights.length).toBe(1);
      expect(insights[0].data.insight).toBe("User prefers TypeScript");
    });
  });
});

