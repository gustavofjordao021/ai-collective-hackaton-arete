/**
 * Tests for Chrome storage adapter for Supabase
 *
 * Adapts chrome.storage.local to Supabase's storage interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, string> = {};
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[], callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        for (const [key, value] of Object.entries(items)) {
          mockStorage[key] = value as string;
        }
        callback?.();
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete mockStorage[key];
        }
        callback?.();
      }),
    },
  },
  runtime: {
    lastError: null,
  },
};

// Set up global chrome mock
vi.stubGlobal('chrome', mockChrome);

import { createChromeStorageAdapter } from './storage-adapter';

describe('Chrome Storage Adapter', () => {
  beforeEach(() => {
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  describe('getItem', () => {
    it('should return null for non-existent key', async () => {
      const adapter = createChromeStorageAdapter();
      const result = await adapter.getItem('non-existent');
      expect(result).toBeNull();
    });

    it('should return stored value', async () => {
      mockStorage['test-key'] = 'test-value';
      const adapter = createChromeStorageAdapter();
      const result = await adapter.getItem('test-key');
      expect(result).toBe('test-value');
    });

    it('should call chrome.storage.local.get with correct key', async () => {
      const adapter = createChromeStorageAdapter();
      await adapter.getItem('my-key');
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('my-key', expect.any(Function));
    });
  });

  describe('setItem', () => {
    it('should store value', async () => {
      const adapter = createChromeStorageAdapter();
      await adapter.setItem('new-key', 'new-value');
      expect(mockStorage['new-key']).toBe('new-value');
    });

    it('should call chrome.storage.local.set with correct data', async () => {
      const adapter = createChromeStorageAdapter();
      await adapter.setItem('key', 'value');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { key: 'value' },
        expect.any(Function)
      );
    });

    it('should overwrite existing value', async () => {
      mockStorage['existing'] = 'old';
      const adapter = createChromeStorageAdapter();
      await adapter.setItem('existing', 'new');
      expect(mockStorage['existing']).toBe('new');
    });
  });

  describe('removeItem', () => {
    it('should remove stored value', async () => {
      mockStorage['to-remove'] = 'value';
      const adapter = createChromeStorageAdapter();
      await adapter.removeItem('to-remove');
      expect(mockStorage['to-remove']).toBeUndefined();
    });

    it('should call chrome.storage.local.remove with correct key', async () => {
      const adapter = createChromeStorageAdapter();
      await adapter.removeItem('key');
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith('key', expect.any(Function));
    });

    it('should not throw for non-existent key', async () => {
      const adapter = createChromeStorageAdapter();
      await expect(adapter.removeItem('non-existent')).resolves.not.toThrow();
    });
  });

  describe('prefix option', () => {
    it('should prefix keys when storing', async () => {
      const adapter = createChromeStorageAdapter({ prefix: 'arete_' });
      await adapter.setItem('session', 'data');
      expect(mockStorage['arete_session']).toBe('data');
    });

    it('should prefix keys when retrieving', async () => {
      mockStorage['arete_session'] = 'stored-data';
      const adapter = createChromeStorageAdapter({ prefix: 'arete_' });
      const result = await adapter.getItem('session');
      expect(result).toBe('stored-data');
    });

    it('should prefix keys when removing', async () => {
      mockStorage['arete_to-delete'] = 'value';
      const adapter = createChromeStorageAdapter({ prefix: 'arete_' });
      await adapter.removeItem('to-delete');
      expect(mockStorage['arete_to-delete']).toBeUndefined();
    });
  });
});
