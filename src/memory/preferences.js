import { memory } from './store.js';

/**
 * Preference categories for organizing learned facts
 */
const CATEGORIES = {
  format: ['bullet', 'concise', 'detailed', 'paragraph', 'list', 'short', 'brief'],
  topics: ['fintech', 'ai', 'developer', 'saas', 'startup', 'tech', 'code', 'programming'],
  style: ['direct', 'casual', 'formal', 'technical', 'simple'],
  tools: ['react', 'typescript', 'node', 'python', 'vscode', 'chrome'],
};

/**
 * Categorize a fact based on keywords
 */
function categorize(fact) {
  const lower = fact.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'general';
}

/**
 * Store a preference with automatic categorization
 */
export async function storePreference(fact) {
  const category = categorize(fact);
  await memory.append('preferences', category, {
    fact,
    timestamp: Date.now(),
  });
  console.log(`Arete: Stored preference [${category}]:`, fact);
}

/**
 * Get preferences by category
 */
export async function getPreferences(category) {
  const data = await memory.get('preferences', category);
  return data || [];
}

/**
 * Get all preferences organized by category
 */
export async function getAllPreferences() {
  const all = await memory.getAll('preferences');
  return all;
}

/**
 * Get preferences formatted for system prompt
 */
export async function getPreferencesForPrompt() {
  const all = await memory.getAll('preferences');
  if (!all || Object.keys(all).length === 0) return '';

  const lines = [];
  for (const [category, items] of Object.entries(all)) {
    if (items && items.length > 0) {
      const uniqueFacts = [...new Set(items.map(i => i.fact))].slice(0, 3);
      lines.push(`${category}: ${uniqueFacts.join(', ')}`);
    }
  }

  if (lines.length === 0) return '';
  return `\n\nUser preferences:\n${lines.join('\n')}`;
}

/**
 * Clear all preferences
 */
export async function clearPreferences() {
  await memory.clearNamespace('preferences');
}
