/**
 * Tests for Supabase client
 *
 * These tests verify the client factory and configuration.
 * Integration tests require a real Supabase instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js before importing client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signInWithIdToken: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

import { createClient } from '@supabase/supabase-js';
import { createAreteClient, getSupabaseConfig, type AreteClientOptions } from './client';

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupabaseConfig', () => {
    it('should return config from environment variables', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
      };

      const config = getSupabaseConfig();
      expect(config.url).toBe('https://test.supabase.co');
      expect(config.anonKey).toBe('test-anon-key');

      process.env = originalEnv;
    });

    it('should throw if SUPABASE_URL is missing', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      expect(() => getSupabaseConfig()).toThrow('SUPABASE_URL');

      process.env = originalEnv;
    });
  });

  describe('createAreteClient', () => {
    const validOptions: AreteClientOptions = {
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    };

    it('should create a Supabase client with correct URL and key', () => {
      createAreteClient(validOptions);

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.any(Object)
      );
    });

    it('should configure autoRefreshToken', () => {
      createAreteClient(validOptions);

      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: true,
          }),
        })
      );
    });

    it('should configure persistSession', () => {
      createAreteClient(validOptions);

      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
          }),
        })
      );
    });

    it('should use custom storage if provided', () => {
      const customStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };

      createAreteClient({ ...validOptions, storage: customStorage });

      expect(createClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          auth: expect.objectContaining({
            storage: customStorage,
          }),
        })
      );
    });

    it('should return client with identity methods', () => {
      const client = createAreteClient(validOptions);

      expect(client).toHaveProperty('getIdentity');
      expect(client).toHaveProperty('saveIdentity');
      expect(typeof client.getIdentity).toBe('function');
      expect(typeof client.saveIdentity).toBe('function');
    });

    it('should return client with context methods', () => {
      const client = createAreteClient(validOptions);

      expect(client).toHaveProperty('getRecentContext');
      expect(client).toHaveProperty('addContextEvent');
      expect(typeof client.getRecentContext).toBe('function');
      expect(typeof client.addContextEvent).toBe('function');
    });

    it('should return client with auth methods', () => {
      const client = createAreteClient(validOptions);

      expect(client).toHaveProperty('signInWithGoogle');
      expect(client).toHaveProperty('signOut');
      expect(client).toHaveProperty('getUser');
      expect(typeof client.signInWithGoogle).toBe('function');
      expect(typeof client.signOut).toBe('function');
      expect(typeof client.getUser).toBe('function');
    });

    it('should return client with realtime methods', () => {
      const client = createAreteClient(validOptions);

      expect(client).toHaveProperty('subscribeToIdentityChanges');
      expect(client).toHaveProperty('subscribeToContextChanges');
      expect(typeof client.subscribeToIdentityChanges).toBe('function');
      expect(typeof client.subscribeToContextChanges).toBe('function');
    });
  });
});
