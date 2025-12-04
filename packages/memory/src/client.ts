/**
 * Mem0 Client Wrapper
 *
 * Provides a typed interface to Mem0's memory operations.
 * Uses the cloud API for simplicity (can switch to self-hosted later).
 */

import { MemoryClient, type Message as Mem0Message, type Memory as Mem0Memory } from "mem0ai";

// Re-export mem0ai types
export type Message = Mem0Message;

// Our simplified memory interface for internal use
export interface Memory {
  id: string;
  memory?: string;
  data?: { memory: string } | null;
  user_id?: string;
  agent_id?: string;
  created_at?: Date;
  updated_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  memory: string;
  score?: number;
  user_id?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryConfig {
  apiKey: string;
  userId?: string;
  agentId?: string;
}

/**
 * Arete Memory Client - wraps Mem0 for our use case
 */
export class AreteMemory {
  private client: MemoryClient;
  private defaultUserId: string;
  private agentId: string;

  constructor(config: MemoryConfig) {
    this.client = new MemoryClient({ apiKey: config.apiKey });
    this.defaultUserId = config.userId || "arete-user";
    this.agentId = config.agentId || "arete-agent";
  }

  /**
   * Add memories from a conversation exchange
   * Mem0 automatically extracts and deduplicates facts
   */
  async addFromConversation(
    messages: Message[],
    userId?: string
  ): Promise<Memory[]> {
    const result = await this.client.add(messages, {
      user_id: userId || this.defaultUserId,
      agent_id: this.agentId,
    });
    return result as unknown as Memory[];
  }

  /**
   * Search for relevant memories given a query
   */
  async search(
    query: string,
    userId?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    const results = await this.client.search(query, {
      user_id: userId || this.defaultUserId,
      limit,
    });
    return results as SearchResult[];
  }

  /**
   * Get all memories for a user
   */
  async getAll(userId?: string): Promise<Memory[]> {
    const results = await this.client.getAll({
      user_id: userId || this.defaultUserId,
    });
    return results as Memory[];
  }

  /**
   * Get a specific memory by ID
   */
  async get(memoryId: string): Promise<Memory | null> {
    try {
      const result = await this.client.get(memoryId);
      return result as Memory;
    } catch {
      return null;
    }
  }

  /**
   * Delete a specific memory
   */
  async delete(memoryId: string): Promise<boolean> {
    try {
      await this.client.delete(memoryId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all memories for a user
   */
  async deleteAll(userId?: string): Promise<boolean> {
    try {
      await this.client.deleteAll({
        user_id: userId || this.defaultUserId,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get memory history (changes over time)
   */
  async getHistory(memoryId: string): Promise<unknown[]> {
    try {
      const history = await this.client.history(memoryId);
      return history as unknown[];
    } catch {
      return [];
    }
  }
}

/**
 * Create a new AreteMemory instance
 */
export function createMemoryClient(config: MemoryConfig): AreteMemory {
  return new AreteMemory(config);
}
