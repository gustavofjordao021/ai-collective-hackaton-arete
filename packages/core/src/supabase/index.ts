/**
 * Supabase integration for Arete
 *
 * @example
 * ```typescript
 * import { createAreteClient } from '@arete/core/supabase';
 *
 * const client = createAreteClient({
 *   url: process.env.SUPABASE_URL,
 *   anonKey: process.env.SUPABASE_ANON_KEY,
 * });
 *
 * // Get user identity
 * const identity = await client.getIdentity();
 *
 * // Subscribe to changes
 * const unsubscribe = client.subscribeToIdentityChanges((identity) => {
 *   console.log('Identity updated:', identity);
 * });
 * ```
 */

export {
  createAreteClient,
  getSupabaseConfig,
  type AreteClient,
  type AreteClientOptions,
  type StorageAdapter,
  type ContextEvent,
  type ContextEventInput,
  type ContextQueryOptions,
} from './client';
