/**
 * Merged Context - Combines local and cloud context for injection
 *
 * Provides getMergedFacts() and getMergedBrowsingContext() that:
 * 1. Load local facts/pages from chrome.storage
 * 2. Load cloud facts/pages from Supabase (if authenticated)
 * 3. Deduplicate using Jaccard similarity
 * 4. Return merged, optimized list
 */

import { getAuthState } from '../supabase/auth';
import { loadFactsFromCloud, loadPagesFromCloud } from '../supabase/context-sync';

// Constants (match manager.js)
const MAX_FACT_CHARS = 4000;
const SIMILARITY_THRESHOLD = 0.7;

interface LocalFact {
  fact: string;
  _timestamp: number;
}

interface MergedFact {
  fact: string;
  _timestamp: number;
  _source: 'local' | 'cloud';
}

interface LocalPage {
  url: string;
  title: string;
  hostname: string;
  timestamp: number;
}

interface MergedPage {
  url: string;
  title: string;
  hostname: string;
  timestamp: number;
  _source: 'local' | 'cloud';
}

/**
 * Calculate Jaccard similarity between two strings
 */
function stringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Deduplicate facts using Jaccard similarity
 * Keeps the most recent version of similar facts
 */
function deduplicateFacts(facts: MergedFact[]): MergedFact[] {
  const result: MergedFact[] = [];

  for (const fact of facts) {
    let isDuplicate = false;

    for (let i = 0; i < result.length; i++) {
      const similarity = stringSimilarity(fact.fact, result[i].fact);
      if (similarity >= SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        // Keep the more recent one
        if (fact._timestamp > result[i]._timestamp) {
          result[i] = fact;
        }
        break;
      }
    }

    if (!isDuplicate) {
      result.push(fact);
    }
  }

  return result;
}

/**
 * Get merged facts from local storage + cloud
 * @param maxChars Character budget (default 4000)
 * @returns Array of fact strings
 */
export async function getMergedFacts(maxChars: number = MAX_FACT_CHARS): Promise<string[]> {
  // 1. Get local facts from chrome.storage
  let localFacts: MergedFact[] = [];
  try {
    const data = await chrome.storage.local.get('arete_facts_learned');
    const localData: LocalFact[] = data['arete_facts_learned'] || [];
    localFacts = localData.map((f) => ({
      fact: f.fact,
      _timestamp: f._timestamp,
      _source: 'local' as const,
    }));
  } catch (err) {
    console.warn('Arete: Failed to load local facts:', err);
  }

  // 2. Try to get cloud facts if authenticated
  let cloudFacts: MergedFact[] = [];
  try {
    const authState = await getAuthState();
    if (authState.isAuthenticated) {
      const cloudData = await loadFactsFromCloud();
      cloudFacts = cloudData.map((f) => ({
        fact: f.fact,
        _timestamp: f._timestamp,
        _source: 'cloud' as const,
      }));
    }
  } catch (err) {
    console.warn('Arete: Cloud fact fetch failed, using local only:', err);
  }

  // 3. Merge and deduplicate
  const allFacts = [...localFacts, ...cloudFacts];
  const deduped = deduplicateFacts(allFacts);

  // 4. Sort by timestamp (newest first)
  deduped.sort((a, b) => b._timestamp - a._timestamp);

  // 5. Apply character budget
  let totalChars = 0;
  const selected: string[] = [];

  for (const f of deduped) {
    if (totalChars + f.fact.length > maxChars) break;
    totalChars += f.fact.length;
    selected.push(f.fact);
  }

  return selected;
}

/**
 * Get merged facts formatted for prompt injection
 */
export async function getMergedFactsForPrompt(): Promise<string> {
  const facts = await getMergedFacts();
  if (facts.length === 0) return '';

  return `\n\nLearned about this user:\n${facts.map((f) => `- ${f}`).join('\n')}`;
}

/**
 * Get merged browsing context from local + cloud
 */
export async function getMergedBrowsingContext(): Promise<string> {
  // 1. Get local pages from chrome.storage
  let localPages: MergedPage[] = [];
  try {
    const data = await chrome.storage.local.get('arete_context_pages');
    const localData: LocalPage[] = data['arete_context_pages'] || [];
    localPages = localData.map((p) => ({
      ...p,
      _source: 'local' as const,
    }));
  } catch (err) {
    console.warn('Arete: Failed to load local pages:', err);
  }

  // 2. Try to get cloud pages if authenticated
  let cloudPages: MergedPage[] = [];
  try {
    const authState = await getAuthState();
    if (authState.isAuthenticated) {
      const cloudData = await loadPagesFromCloud();
      cloudPages = cloudData.map((p) => ({
        url: p.url,
        title: p.title,
        hostname: p.hostname,
        timestamp: p.timestamp,
        _source: 'cloud' as const,
      }));
    }
  } catch (err) {
    console.warn('Arete: Cloud page fetch failed, using local only:', err);
  }

  // 3. Merge and deduplicate by URL (keep most recent)
  const urlMap = new Map<string, MergedPage>();
  for (const page of [...localPages, ...cloudPages]) {
    const existing = urlMap.get(page.url);
    if (!existing || page.timestamp > existing.timestamp) {
      urlMap.set(page.url, page);
    }
  }

  // 4. Sort by timestamp (newest first)
  const pages = Array.from(urlMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  if (pages.length === 0) return '';

  // 5. Get unique hostnames (max 5)
  const sites = [...new Set(pages.map((p) => p.hostname))].slice(0, 5);
  return `\n\nRecent browsing: ${sites.join(', ')}`;
}
