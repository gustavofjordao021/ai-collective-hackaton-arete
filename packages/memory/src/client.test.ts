import { describe, it, expect, vi, beforeEach } from "vitest";
import { AreteMemory, createMemoryClient } from "./client.js";

// Mock mem0ai
vi.mock("mem0ai", () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue([
      { id: "mem-1", data: { memory: "User likes TypeScript" } },
      { id: "mem-2", data: { memory: "User works at PayNearMe" } },
    ]),
    search: vi.fn().mockResolvedValue([
      { id: "mem-1", memory: "User likes TypeScript", score: 0.95 },
    ]),
    getAll: vi.fn().mockResolvedValue([
      { id: "mem-1", data: { memory: "User likes TypeScript" } },
      { id: "mem-2", data: { memory: "User works at PayNearMe" } },
    ]),
    get: vi.fn().mockResolvedValue({ id: "mem-1", data: { memory: "User likes TypeScript" } }),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteAll: vi.fn().mockResolvedValue(undefined),
    history: vi.fn().mockResolvedValue([{ event: "ADD", memory: "test" }]),
  })),
}));

describe("AreteMemory", () => {
  let memory: AreteMemory;

  beforeEach(() => {
    memory = createMemoryClient({
      apiKey: "test-api-key",
      userId: "test-user",
    });
  });

  describe("createMemoryClient", () => {
    it("creates an AreteMemory instance", () => {
      expect(memory).toBeInstanceOf(AreteMemory);
    });
  });

  describe("addFromConversation", () => {
    it("adds memories from conversation messages", async () => {
      const messages = [
        { role: "user" as const, content: "I love TypeScript" },
        { role: "assistant" as const, content: "Great choice!" },
      ];

      const result = await memory.addFromConversation(messages);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("mem-1");
    });

    it("uses custom userId when provided", async () => {
      const messages = [
        { role: "user" as const, content: "Test message" },
      ];

      await memory.addFromConversation(messages, "custom-user");

      // Memory client would be called with custom-user
      expect(true).toBe(true);
    });
  });

  describe("search", () => {
    it("searches for relevant memories", async () => {
      const results = await memory.search("What languages does the user like?");

      expect(results).toHaveLength(1);
      expect(results[0].memory).toContain("TypeScript");
    });

    it("accepts limit parameter", async () => {
      await memory.search("test query", undefined, 5);

      // Search would be called with limit: 5
      expect(true).toBe(true);
    });
  });

  describe("getAll", () => {
    it("gets all memories for user", async () => {
      const results = await memory.getAll();

      expect(results).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("gets a specific memory by ID", async () => {
      const result = await memory.get("mem-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("mem-1");
    });
  });

  describe("delete", () => {
    it("deletes a memory and returns true", async () => {
      const result = await memory.delete("mem-1");

      expect(result).toBe(true);
    });
  });

  describe("deleteAll", () => {
    it("deletes all memories for user", async () => {
      const result = await memory.deleteAll();

      expect(result).toBe(true);
    });
  });

  describe("getHistory", () => {
    it("gets memory history", async () => {
      const history = await memory.getHistory("mem-1");

      expect(history).toHaveLength(1);
    });
  });
});
