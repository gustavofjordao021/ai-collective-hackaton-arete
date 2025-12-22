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
import {
  loadFactsFromCloud,
  loadPagesFromCloud,
  loadIdentityFactsFromCloud,
  type IdentityFact,
} from '../supabase/context-sync';

// Constants (match manager.js)
const MAX_FACT_CHARS = 4000;
const SIMILARITY_THRESHOLD = 0.7;
const CONFIDENCE_THRESHOLD = 0.3;
const CONFIDENCE_HALF_LIFE_DAYS = 60;

// Maturity ranking (higher = more trusted)
const MATURITY_RANK: Record<IdentityFact['maturity'], number> = {
  proven: 3,
  established: 2,
  candidate: 1,
};

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
 * Calculate days between two dates
 */
function daysBetween(date1: Date | string, date2: Date): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const diffMs = Math.abs(date2.getTime() - d1.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Calculate effective confidence with decay
 * Uses exponential decay with 60-day half-life
 */
function getEffectiveConfidence(fact: IdentityFact): number {
  const daysSince = daysBetween(fact.lastValidated, new Date());
  return fact.confidence * Math.pow(0.5, daysSince / CONFIDENCE_HALF_LIFE_DAYS);
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
 * Combines identity facts (curated, v2) with context events (raw insights)
 */
export async function getMergedFactsForPrompt(): Promise<string> {
  // 1. Load identity facts from identities table (if authenticated)
  let identityFacts: IdentityFact[] = [];
  try {
    const authState = await getAuthState();
    if (authState.isAuthenticated) {
      identityFacts = await loadIdentityFactsFromCloud();
    }
  } catch (err) {
    console.warn('Arete: Failed to load identity facts:', err);
  }

  // 2. Filter by effective confidence > threshold
  const validIdentityFacts = identityFacts.filter(
    (f) => getEffectiveConfidence(f) > CONFIDENCE_THRESHOLD
  );

  // 3. Sort by maturity (proven > established > candidate)
  validIdentityFacts.sort((a, b) => MATURITY_RANK[b.maturity] - MATURITY_RANK[a.maturity]);

  // 4. Get context events (raw insights)
  const contextFacts = await getMergedFacts();

  // 5. Deduplicate context facts against identity facts (identity takes priority)
  const dedupedContextFacts = contextFacts.filter((contextFact) => {
    for (const identityFact of validIdentityFacts) {
      const similarity = stringSimilarity(contextFact, identityFact.content);
      if (similarity >= SIMILARITY_THRESHOLD) {
        return false; // Skip this context fact, identity fact takes priority
      }
    }
    return true;
  });

  // 6. Format output with sections
  const sections: string[] = [];

  // "About this user" section for identity facts
  if (validIdentityFacts.length > 0) {
    const identityLines = validIdentityFacts.map(
      (f) => `- ${f.content} [${f.maturity}]`
    );
    sections.push(`About this user:\n${identityLines.join('\n')}`);
  }

  // "Recent learnings" section for context events
  if (dedupedContextFacts.length > 0) {
    const contextLines = dedupedContextFacts.map((f) => `- ${f}`);
    sections.push(`Recent learnings:\n${contextLines.join('\n')}`);
  }

  // Return empty string if no facts at all
  if (sections.length === 0) return '';

  return `\n\n${sections.join('\n\n')}`;
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
