/**
 * Memory Store - Namespaced chrome.storage.local wrapper
 *
 * Namespaces:
 * - identity: core user identity
 * - facts: learned facts from conversations
 * - preferences: user preferences (format, style, etc.)
 * - context: page contexts and history
 * - conversation: chat history (existing)
 */

const PREFIX = 'arete_';

export const memory = {
  /**
   * Get a value from a namespace
   */
  async get(namespace, key) {
    const fullKey = `${PREFIX}${namespace}_${key}`;
    const data = await chrome.storage.local.get(fullKey);
    return data[fullKey] ?? null;
  },

  /**
   * Set a value in a namespace
   */
  async set(namespace, key, value) {
    const fullKey = `${PREFIX}${namespace}_${key}`;
    await chrome.storage.local.set({ [fullKey]: value });
  },

  /**
   * Append an item to an array in a namespace
   */
  async append(namespace, key, item) {
    const fullKey = `${PREFIX}${namespace}_${key}`;
    const data = await chrome.storage.local.get(fullKey);
    const arr = data[fullKey] ?? [];
    arr.push({
      ...item,
      _timestamp: Date.now(),
    });
    await chrome.storage.local.set({ [fullKey]: arr });
  },

  /**
   * Get all keys in a namespace
   */
  async getAll(namespace) {
    const all = await chrome.storage.local.get(null);
    const prefix = `${PREFIX}${namespace}_`;
    const result = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(prefix)) {
        const shortKey = key.slice(prefix.length);
        result[shortKey] = value;
      }
    }
    return result;
  },

  /**
   * Remove a key from a namespace
   */
  async remove(namespace, key) {
    const fullKey = `${PREFIX}${namespace}_${key}`;
    await chrome.storage.local.remove(fullKey);
  },

  /**
   * Clear all data in a namespace
   */
  async clearNamespace(namespace) {
    const all = await chrome.storage.local.get(null);
    const prefix = `${PREFIX}${namespace}_`;
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(prefix));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  },

  /**
   * Clear ALL Arete data
   */
  async clearAll() {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(PREFIX));
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  },

  /**
   * Get storage stats
   */
  async getStats() {
    const all = await chrome.storage.local.get(null);
    const namespaces = {};
    let totalSize = 0;

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(PREFIX)) {
        const size = JSON.stringify(value).length;
        totalSize += size;

        const namespace = key.slice(PREFIX.length).split('_')[0];
        namespaces[namespace] = (namespaces[namespace] || 0) + size;
      }
    }

    return {
      totalSize,
      namespaces,
      totalKeys: Object.keys(all).filter(k => k.startsWith(PREFIX)).length,
    };
  },
};
