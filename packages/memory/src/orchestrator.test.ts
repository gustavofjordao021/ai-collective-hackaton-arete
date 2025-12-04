import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextOrchestrator, createOrchestrator } from "./orchestrator.js";
import { AreteMemory } from "./client.js";
import type { AreteIdentity } from "@arete/core";

// Mock identity
const mockIdentity: AreteIdentity = {
  meta: {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    deviceId: "test",
  },
  core: {
    name: "Test User",
    role: "Developer",
    location: "San Francisco",
    background: "Building AI products",
  },
  communication: {
    style: ["direct", "technical"],
    format: ["code examples"],
    avoid: ["fluff"],
  },
  expertise: ["TypeScript", "AI"],
  currentFocus: {
    projects: [],
    goals: ["Build cool stuff"],
  },
  context: {
    personal: [],
    professional: ["Startup founder"],
  },
  privacy: {
    public: [],
    private: [],
    localOnly: [],
  },
  custom: {},
  sources: [],
};

// Mock AreteMemory
const createMockMemory = () => ({
  search: vi.fn().mockResolvedValue([
    { id: "1", memory: "User prefers TypeScript", score: 0.9 },
    { id: "2", memory: "User is building a Chrome extension", score: 0.85 },
  ]),
  addFromConversation: vi.fn().mockResolvedValue([]),
} as unknown as AreteMemory);

// Mock identity transform
const mockTransform = (identity: AreteIdentity, model: string) => {
  if (model === "claude") {
    return `<user_identity>\nName: ${identity.core.name}\nRole: ${identity.core.role}\n</user_identity>`;
  }
  return `## User Profile\n**Name:** ${identity.core.name}\n**Role:** ${identity.core.role}`;
};

describe("ContextOrchestrator", () => {
  let orchestrator: ContextOrchestrator;
  let mockMemory: ReturnType<typeof createMockMemory>;

  beforeEach(() => {
    mockMemory = createMockMemory();
    orchestrator = createOrchestrator(mockMemory, mockTransform);
  });

  describe("buildContext", () => {
    it("builds context with identity and memories for Claude", async () => {
      const context = await orchestrator.buildContext(mockIdentity, {
        query: "What technologies does the user know?",
        model: "claude",
      });

      expect(context.identityPrompt).toContain("<user_identity>");
      expect(context.identityPrompt).toContain("Test User");
      expect(context.memoriesPrompt).toContain("<relevant_memories>");
      expect(context.memoriesPrompt).toContain("TypeScript");
      expect(context.memories).toHaveLength(2);
    });

    it("builds context with identity and memories for OpenAI", async () => {
      const context = await orchestrator.buildContext(mockIdentity, {
        query: "What is the user working on?",
        model: "openai",
      });

      expect(context.identityPrompt).toContain("## User Profile");
      expect(context.memoriesPrompt).toContain("## Relevant Memories");
      expect(context.fullPrompt).toContain("---");
    });

    it("excludes identity when includeIdentity is false", async () => {
      const context = await orchestrator.buildContext(mockIdentity, {
        query: "test",
        model: "claude",
        includeIdentity: false,
      });

      expect(context.identityPrompt).toBe("");
    });

    it("excludes memories when includeMemories is false", async () => {
      const context = await orchestrator.buildContext(mockIdentity, {
        query: "test",
        model: "claude",
        includeMemories: false,
      });

      expect(context.memoriesPrompt).toBe("");
      expect(context.memories).toHaveLength(0);
    });

    it("searches memories with custom limit", async () => {
      await orchestrator.buildContext(mockIdentity, {
        query: "test",
        model: "claude",
        maxMemories: 5,
      });

      expect(mockMemory.search).toHaveBeenCalledWith("test", undefined, 5);
    });

    it("estimates token count", async () => {
      const context = await orchestrator.buildContext(mockIdentity, {
        query: "test",
        model: "claude",
      });

      expect(context.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe("addConversation", () => {
    it("adds conversation to memory", async () => {
      await orchestrator.addConversation(
        "I love TypeScript",
        "Great choice!",
        "user-123"
      );

      expect(mockMemory.addFromConversation).toHaveBeenCalledWith(
        [
          { role: "user", content: "I love TypeScript" },
          { role: "assistant", content: "Great choice!" },
        ],
        "user-123"
      );
    });
  });
});

describe("createOrchestrator", () => {
  it("creates a ContextOrchestrator instance", () => {
    const mockMemory = createMockMemory();
    const orchestrator = createOrchestrator(mockMemory, mockTransform);

    expect(orchestrator).toBeInstanceOf(ContextOrchestrator);
  });
});
