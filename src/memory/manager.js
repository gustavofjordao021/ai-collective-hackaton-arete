/**
 * Memory Manager - Token budgets, importance scoring, auto-pruning
 *
 * Cycle 25: Prevents memory from growing forever
 */

import { memory } from './store.js';

// Configuration - these are approximate character limits (not exact tokens)
const LIMITS = {
  maxFacts: 50,           // Maximum number of facts to keep
  maxPages: 20,           // Maximum number of pages to remember
  maxFactChars: 4000,     // Total character budget for facts in prompts
  maxPageChars: 2000,     // Total character budget for page contexts
};

// Similarity threshold for deduplication (0-1, higher = stricter)
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Calculate simple string similarity (Jaccard index on words)
 */
function stringSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if a fact is a duplicate of existing facts
 */
export async function isDuplicateFact(newFact) {
  const existingFacts = await memory.get('facts', 'learned') || [];

  for (const existing of existingFacts) {
    const existingText = existing.fact || existing;
    const similarity = stringSimilarity(newFact, existingText);

    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(`Arete: Duplicate fact detected (${(similarity * 100).toFixed(0)}% similar):`, newFact);
      return true;
    }
  }

  return false;
}

/**
 * Calculate importance score for a fact
 * Higher score = more important = keep longer
 */
function calculateImportance(fact) {
  let score = 50; // Base score

  // Recency bonus (newer = higher score)
  const age = Date.now() - (fact._timestamp || 0);
  const daysSinceCreated = age / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - daysSinceCreated); // Up to 30 bonus for recent facts

  // Content-based scoring
  const text = fact.fact || fact;

  // Core identity facts (name, job, location) are more important
  const corePatterns = ['works at', 'based in', 'lives in', 'name is', 'located'];
  if (corePatterns.some(p => text.toLowerCase().includes(p))) {
    score += 25;
  }

  // Technical skills are valuable
  if (/react|typescript|node|python|javascript|developer|engineer/i.test(text)) {
    score += 15;
  }

  // Preferences are moderately important
  if (/prefers|likes|wants|style/i.test(text)) {
    score += 10;
  }

  return score;
}

/**
 * Prune facts if over limit, keeping most important ones
 */
export async function pruneFacts() {
  const facts = await memory.get('facts', 'learned') || [];

  if (facts.length <= LIMITS.maxFacts) {
    return facts; // No pruning needed
  }

  console.log(`Arete: Pruning facts (${facts.length} -> ${LIMITS.maxFacts})`);

  // Score all facts
  const scoredFacts = facts.map(f => ({
    ...f,
    _importance: calculateImportance(f)
  }));

  // Sort by importance (highest first)
  scoredFacts.sort((a, b) => b._importance - a._importance);

  // Keep only top N facts
  const keptFacts = scoredFacts.slice(0, LIMITS.maxFacts);

  // Remove temporary _importance field
  const cleanFacts = keptFacts.map(f => {
    const { _importance, ...rest } = f;
    return rest;
  });

  // Save pruned list
  await memory.set('facts', 'learned', cleanFacts);

  console.log(`Arete: Kept ${cleanFacts.length} most important facts`);
  return cleanFacts;
}

/**
 * Prune pages if over limit, keeping most recent
 */
export async function prunePages() {
  const pages = await memory.get('context', 'pages') || [];

  if (pages.length <= LIMITS.maxPages) {
    return pages;
  }

  console.log(`Arete: Pruning pages (${pages.length} -> ${LIMITS.maxPages})`);

  // Sort by timestamp (most recent first)
  const sorted = [...pages].sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));

  // Keep only top N pages
  const keptPages = sorted.slice(0, LIMITS.maxPages);

  // Save pruned list
  await memory.set('context', 'pages', keptPages);

  console.log(`Arete: Kept ${keptPages.length} most recent pages`);
  return keptPages;
}

/**
 * Get facts optimized for prompt injection (within token budget)
 */
export async function getOptimizedFacts(maxChars = LIMITS.maxFactChars) {
  const facts = await memory.get('facts', 'learned') || [];

  if (facts.length === 0) return [];

  // Score and sort by importance
  const scoredFacts = facts.map(f => ({
    ...f,
    _importance: calculateImportance(f)
  }));
  scoredFacts.sort((a, b) => b._importance - a._importance);

  // Deduplicate by text
  const seen = new Set();
  const uniqueFacts = [];

  for (const f of scoredFacts) {
    const text = f.fact || f;
    if (!seen.has(text)) {
      seen.add(text);
      uniqueFacts.push(f);
    }
  }

  // Select facts within character budget
  let totalChars = 0;
  const selectedFacts = [];

  for (const f of uniqueFacts) {
    const text = f.fact || f;
    if (totalChars + text.length > maxChars) break;
    totalChars += text.length;
    selectedFacts.push(text);
  }

  return selectedFacts;
}

/**
 * Get pages optimized for prompt injection (within token budget)
 */
export async function getOptimizedPages(maxChars = LIMITS.maxPageChars) {
  const pages = await memory.get('context', 'pages') || [];

  if (pages.length === 0) return [];

  // Sort by recency
  const sorted = [...pages].sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));

  // Deduplicate by URL
  const seen = new Set();
  const uniquePages = [];

  for (const p of sorted) {
    if (!seen.has(p.url)) {
      seen.add(p.url);
      uniquePages.push(p);
    }
  }

  // Select pages within character budget
  let totalChars = 0;
  const selectedPages = [];

  for (const p of uniquePages) {
    const entry = `${p.title} (${p.url})`;
    if (totalChars + entry.length > maxChars) break;
    totalChars += entry.length;
    selectedPages.push(p);
  }

  return selectedPages;
}

/**
 * Run all pruning operations
 */
export async function pruneAll() {
  await pruneFacts();
  await prunePages();
  console.log('Arete: Memory pruning complete');
}

/**
 * Get memory usage stats
 */
export async function getMemoryUsage() {
  const facts = await memory.get('facts', 'learned') || [];
  const pages = await memory.get('context', 'pages') || [];

  const factsSize = JSON.stringify(facts).length;
  const pagesSize = JSON.stringify(pages).length;

  return {
    facts: {
      count: facts.length,
      limit: LIMITS.maxFacts,
      percent: Math.round((facts.length / LIMITS.maxFacts) * 100),
      bytes: factsSize,
    },
    pages: {
      count: pages.length,
      limit: LIMITS.maxPages,
      percent: Math.round((pages.length / LIMITS.maxPages) * 100),
      bytes: pagesSize,
    },
    total: {
      bytes: factsSize + pagesSize,
      kb: ((factsSize + pagesSize) / 1024).toFixed(1),
    },
  };
}

/**
 * Export configuration for external use
 */
export const MEMORY_LIMITS = LIMITS;
