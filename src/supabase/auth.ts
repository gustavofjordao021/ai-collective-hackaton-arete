/**
 * Google OAuth authentication via chrome.identity + Supabase
 *
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. chrome.identity.launchWebAuthFlow opens Google OAuth
 * 3. User authorizes, Google redirects with id_token
 * 4. We extract id_token and send to Supabase signInWithIdToken
 * 5. Supabase creates/returns user session
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createChromeStorageAdapter } from './storage-adapter';

export interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email?: string } | null;
  loading: boolean;
}

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Singleton Supabase client - lazy initialized
let supabaseClient: SupabaseClient | null = null;
let authConfig: AuthConfig | null = null;

/**
 * Initialize auth with Supabase credentials
 * Must be called before using other auth functions in production
 */
export function initAuth(config: AuthConfig): void {
  authConfig = config;
  supabaseClient = null; // Reset client so it gets recreated with new config
}

/**
 * Set a custom Supabase client (for testing)
 * @internal
 */
export function _setSupabaseClient(client: SupabaseClient | null): void {
  supabaseClient = client;
}

/**
 * Reset auth state (for testing)
 * @internal
 */
export function _resetAuth(): void {
  supabaseClient = null;
  authConfig = null;
}

/**
 * Get or create the Supabase client
 */
function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  // Try config first, then env vars
  const supabaseUrl = authConfig?.supabaseUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const supabaseAnonKey = authConfig?.supabaseAnonKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key must be configured. Call initAuth() first.');
  }

  const storage = createChromeStorageAdapter({ prefix: 'arete_auth_' });

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage,
    },
  });

  return supabaseClient;
}

/**
 * Build the Google OAuth URL for chrome.identity
 */
function buildGoogleAuthUrl(): string {
  const manifest = chrome.runtime.getManifest();
  const oauth2 = manifest.oauth2;

  if (!oauth2?.client_id) {
    throw new Error('OAuth2 client_id not configured in manifest.json');
  }

  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org`;
  const scopes = oauth2.scopes?.join(' ') || 'openid email profile';

  const url = new URL('https://accounts.google.com/o/oauth2/auth');
  url.searchParams.set('client_id', oauth2.client_id);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('nonce', crypto.randomUUID());

  return url.toString();
}

/**
 * Extract id_token from redirect URL hash
 */
function extractIdToken(redirectUrl: string): string {
  const url = new URL(redirectUrl);
  const hash = url.hash.substring(1); // Remove leading #
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');

  if (!idToken) {
    throw new Error('No id_token found in redirect URL');
  }

  return idToken;
}

/**
 * Sign in with Google using chrome.identity
 *
 * @example
 * ```typescript
 * try {
 *   await signInWithGoogle();
 *   console.log('Signed in!');
 * } catch (error) {
 *   console.error('Sign in failed:', error);
 * }
 * ```
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  const authUrl = buildGoogleAuthUrl();

  // Launch Chrome's identity flow
  const redirectUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error('No redirect URL received from Google'));
          return;
        }
        resolve(responseUrl);
      }
    );
  });

  // Extract the id_token
  const idToken = extractIdToken(redirectUrl);

  // Sign in to Supabase with the Google id_token
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('No user returned from Supabase');
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  // Clear Chrome's cached auth tokens
  await new Promise<void>((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(() => resolve());
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get current authentication state
 */
export async function getAuthState(): Promise<AuthState> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { isAuthenticated: false, user: null, loading: false };
    }

    return {
      isAuthenticated: true,
      user: { id: data.user.id, email: data.user.email },
      loading: false,
    };
  } catch {
    return { isAuthenticated: false, user: null, loading: false };
  }
}

/**
 * Subscribe to auth state changes
 *
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (state: AuthState) => void
): () => void {
  const supabase = getSupabaseClient();

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({
        isAuthenticated: true,
        user: { id: session.user.id, email: session.user.email },
        loading: false,
      });
    } else {
      callback({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    }
  });

  return () => data.subscription.unsubscribe();
}

/**
 * Get the raw Supabase client for advanced operations
 */
export function getSupabase(): SupabaseClient {
  return getSupabaseClient();
}
