/**
 * Memory Orchestrator
 *
 * Combines identity (static) with memories (dynamic) to build
 * the full context for AI conversations.
 */

import type { AreteIdentity } from "@arete/core";
import { AreteMemory, type SearchResult } from "./client.js";

export interface ContextOptions {
  /** The user's query to search relevant memories */
  query: string;
  /** Which model we're building context for */
  model: "claude" | "openai";
  /** User ID for memory lookup */
  userId?: string;
  /** Maximum memories to include */
  maxMemories?: number;
  /** Include identity in context */
  includeIdentity?: boolean;
  /** Include memories in context */
  includeMemories?: boolean;
}

export interface FullContext {
  /** The formatted system prompt with identity */
  identityPrompt: string;
  /** Relevant memories as formatted text */
  memoriesPrompt: string;
  /** Combined full context */
  fullPrompt: string;
  /** Raw memories for debugging */
  memories: SearchResult[];
  /** Estimated token count */
  estimatedTokens: number;
}

/**
 * Orchestrates identity and memory into unified context
 */
export class ContextOrchestrator {
  private memory: AreteMemory;
  private identityTransform: (identity: AreteIdentity, model: string) => string;

  constructor(
    memory: AreteMemory,
    identityTransform: (identity: AreteIdentity, model: string) => string
  ) {
    this.memory = memory;
    this.identityTransform = identityTransform;
  }

  /**
   * Build full context for a conversation
   */
  async buildContext(
    identity: AreteIdentity,
    options: ContextOptions
  ): Promise<FullContext> {
    const {
      query,
      model,
      userId,
      maxMemories = 10,
      includeIdentity = true,
      includeMemories = true,
    } = options;

    // Get identity prompt
    let identityPrompt = "";
    if (includeIdentity) {
      identityPrompt = this.identityTransform(identity, model);
    }

    // Search relevant memories
    let memories: SearchResult[] = [];
    let memoriesPrompt = "";
    if (includeMemories && query) {
      memories = await this.memory.search(query, userId, maxMemories);
      memoriesPrompt = this.formatMemories(memories, model);
    }

    // Combine into full prompt
    const fullPrompt = this.combinePrompts(identityPrompt, memoriesPrompt, model);
    const estimatedTokens = Math.ceil(fullPrompt.length / 4);

    return {
      identityPrompt,
      memoriesPrompt,
      fullPrompt,
      memories,
      estimatedTokens,
    };
  }

  /**
   * Format memories for inclusion in prompt
   */
  private formatMemories(memories: SearchResult[], model: string): string {
    if (memories.length === 0) return "";

    const memoryLines = memories.map((m) => `- ${m.memory}`).join("\n");

    if (model === "claude") {
      return `<relevant_memories>
${memoryLines}
</relevant_memories>`;
    } else {
      return `## Relevant Memories
${memoryLines}`;
    }
  }

  /**
   * Combine identity and memories into full prompt
   */
  private combinePrompts(
    identityPrompt: string,
    memoriesPrompt: string,
    model: string
  ): string {
    const parts: string[] = [];

    if (identityPrompt) {
      parts.push(identityPrompt);
    }

    if (memoriesPrompt) {
      parts.push(memoriesPrompt);
    }

    if (model === "claude") {
      return parts.join("\n\n");
    } else {
      return parts.join("\n\n---\n\n");
    }
  }

  /**
   * Add a conversation exchange to memory
   */
  async addConversation(
    userMessage: string,
    assistantMessage: string,
    userId?: string
  ): Promise<void> {
    await this.memory.addFromConversation(
      [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ],
      userId
    );
  }
}

/**
 * Create a context orchestrator with default identity transform
 */
export function createOrchestrator(
  memory: AreteMemory,
  identityTransform: (identity: AreteIdentity, model: string) => string
): ContextOrchestrator {
  return new ContextOrchestrator(memory, identityTransform);
}
