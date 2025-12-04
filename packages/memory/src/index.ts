/**
 * @arete/memory
 *
 * Mem0 integration for Arete - persistent AI memory.
 * Combines with @arete/core identity for full context.
 */

export {
  AreteMemory,
  createMemoryClient,
  type Memory,
  type MemoryConfig,
  type Message,
  type SearchResult,
} from "./client.js";

export {
  ContextOrchestrator,
  createOrchestrator,
  type ContextOptions,
  type FullContext,
} from "./orchestrator.js";
