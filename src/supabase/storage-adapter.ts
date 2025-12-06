/**
 * Chrome Storage Adapter for Supabase
 *
 * Adapts chrome.storage.local to Supabase's storage interface
 * for auth session persistence in Chrome extensions.
 */

export interface ChromeStorageAdapterOptions {
  /** Prefix for all storage keys (default: '') */
  prefix?: string;
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Create a storage adapter that uses chrome.storage.local
 *
 * @example
 * ```typescript
 * import { createChromeStorageAdapter } from './storage-adapter';
 *
 * const storage = createChromeStorageAdapter({ prefix: 'arete_auth_' });
 *
 * // Use with Supabase client
 * const supabase = createClient(url, key, {
 *   auth: { storage }
 * });
 * ```
 */
export function createChromeStorageAdapter(
  options: ChromeStorageAdapterOptions = {}
): StorageAdapter {
  const { prefix = '' } = options;

  function prefixKey(key: string): string {
    return `${prefix}${key}`;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const prefixedKey = prefixKey(key);
      return new Promise((resolve) => {
        chrome.storage.local.get(prefixedKey, (result) => {
          resolve(result[prefixedKey] ?? null);
        });
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      const prefixedKey = prefixKey(key);
      return new Promise((resolve) => {
        chrome.storage.local.set({ [prefixedKey]: value }, () => {
          resolve();
        });
      });
    },

    async removeItem(key: string): Promise<void> {
      const prefixedKey = prefixKey(key);
      return new Promise((resolve) => {
        chrome.storage.local.remove(prefixedKey, () => {
          resolve();
        });
      });
    },
  };
}
