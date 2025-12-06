/**
 * Supabase integration for Arete Chrome extension
 */

export {
  signInWithGoogle,
  signOut,
  getAuthState,
  onAuthStateChange,
  getSupabase,
  initAuth,
  type AuthState,
  type AuthUser,
  type AuthConfig,
} from './auth';

export {
  createChromeStorageAdapter,
  type StorageAdapter,
  type ChromeStorageAdapterOptions,
} from './storage-adapter';
