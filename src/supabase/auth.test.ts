/**
 * Tests for Google OAuth authentication via chrome.identity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome APIs
const mockChrome = {
  runtime: {
    getManifest: vi.fn(() => ({
      oauth2: {
        client_id: 'test-client-id.apps.googleusercontent.com',
        scopes: ['openid', 'email', 'profile'],
      },
    })),
    id: 'test-extension-id',
    lastError: null as { message: string } | null,
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    clearAllCachedAuthTokens: vi.fn((callback) => callback()),
  },
  storage: {
    local: {
      get: vi.fn((key, callback) => callback({})),
      set: vi.fn((items, callback) => callback?.()),
      remove: vi.fn((key, callback) => callback?.()),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

// Mock Supabase client
const mockSupabaseAuth = {
  signInWithIdToken: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
};

const mockSupabase = {
  auth: mockSupabaseAuth,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

import {
  signInWithGoogle,
  signOut,
  getAuthState,
  onAuthStateChange,
  _setSupabaseClient,
  _resetAuth,
  type AuthState,
} from './auth';

describe('Google OAuth Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
    // Inject mock Supabase client before each test
    _setSupabaseClient(mockSupabase as any);
  });

  afterEach(() => {
    // Clean up after each test
    _resetAuth();
  });

  describe('signInWithGoogle', () => {
    it('should launch web auth flow with correct URL', async () => {
      const mockIdToken = 'mock-id-token-123';
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(`https://test-extension-id.chromiumapp.org/#id_token=${mockIdToken}`);
      });
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      await signInWithGoogle();

      expect(mockChrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('accounts.google.com'),
          interactive: true,
        }),
        expect.any(Function)
      );
    });

    it('should include client_id in auth URL', async () => {
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(`https://test.chromiumapp.org/#id_token=token`);
      });
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      await signInWithGoogle();

      const [callOptions] = mockChrome.identity.launchWebAuthFlow.mock.calls[0];
      expect(callOptions.url).toContain('client_id=test-client-id.apps.googleusercontent.com');
    });

    it('should request id_token response type', async () => {
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(`https://test.chromiumapp.org/#id_token=token`);
      });
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      await signInWithGoogle();

      const [callOptions] = mockChrome.identity.launchWebAuthFlow.mock.calls[0];
      expect(callOptions.url).toContain('response_type=id_token');
    });

    it('should call Supabase signInWithIdToken with extracted token', async () => {
      const mockIdToken = 'extracted-id-token';
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(`https://test.chromiumapp.org/#id_token=${mockIdToken}`);
      });
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

      await signInWithGoogle();

      expect(mockSupabaseAuth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: mockIdToken,
      });
    });

    it('should throw if chrome.identity fails', async () => {
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        mockChrome.runtime.lastError = { message: 'User cancelled' };
        callback(undefined);
      });

      await expect(signInWithGoogle()).rejects.toThrow('User cancelled');
    });

    it('should throw if no redirect URL returned', async () => {
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(undefined);
      });

      await expect(signInWithGoogle()).rejects.toThrow();
    });

    it('should throw if Supabase auth fails', async () => {
      mockChrome.identity.launchWebAuthFlow.mockImplementation((options, callback) => {
        callback(`https://test.chromiumapp.org/#id_token=token`);
      });
      mockSupabaseAuth.signInWithIdToken.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' },
      });

      await expect(signInWithGoogle()).rejects.toThrow('Invalid token');
    });
  });

  describe('signOut', () => {
    it('should call Supabase signOut', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it('should clear cached auth tokens', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      await signOut();

      expect(mockChrome.identity.clearAllCachedAuthTokens).toHaveBeenCalled();
    });

    it('should throw if signOut fails', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: { message: 'Network error' } });

      await expect(signOut()).rejects.toThrow('Network error');
    });
  });

  describe('getAuthState', () => {
    it('should return authenticated state with user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const state = await getAuthState();

      expect(state).toEqual({
        isAuthenticated: true,
        user: { id: 'user-123', email: 'test@example.com' },
        loading: false,
      });
    });

    it('should return unauthenticated state when no user', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const state = await getAuthState();

      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    });

    it('should return unauthenticated state on error', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const state = await getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('onAuthStateChange', () => {
    it('should register callback with Supabase', () => {
      const callback = vi.fn();
      onAuthStateChange(callback);

      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = onAuthStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });
});
