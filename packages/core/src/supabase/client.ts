/**
 * Arete Supabase Client
 *
 * Wraps @supabase/supabase-js with Arete-specific methods for:
 * - Identity sync
 * - Context events
 * - Real-time subscriptions
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import type { Identity } from '../schema';

// Storage adapter interface (for chrome.storage or localStorage)
export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export interface AreteClientOptions {
  url: string;
  anonKey: string;
  storage?: StorageAdapter;
}

export interface ContextEvent {
  id: string;
  user_id: string;
  type: 'page_visit' | 'selection' | 'conversation' | 'insight' | 'file';
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export interface ContextEventInput {
  type: ContextEvent['type'];
  source: string;
  data: Record<string, unknown>;
}

export interface ContextQueryOptions {
  type?: ContextEvent['type'];
  source?: string;
  limit?: number;
}

export interface AreteClient {
  // Raw Supabase client for advanced use
  supabase: SupabaseClient;

  // Auth methods
  getUser: () => Promise<{ id: string; email?: string } | null>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Identity methods
  getIdentity: () => Promise<Identity | null>;
  saveIdentity: (identity: Identity) => Promise<void>;

  // Context methods
  getRecentContext: (options?: ContextQueryOptions) => Promise<ContextEvent[]>;
  addContextEvent: (event: ContextEventInput) => Promise<ContextEvent>;

  // Real-time subscriptions
  subscribeToIdentityChanges: (callback: (identity: Identity) => void) => () => void;
  subscribeToContextChanges: (callback: (event: ContextEvent) => void) => () => void;
}

/**
 * Get Supabase configuration from environment variables
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }
  if (!anonKey) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }

  return { url, anonKey };
}

/**
 * Create an Arete client with Supabase backend
 */
export function createAreteClient(options: AreteClientOptions): AreteClient {
  const { url, anonKey, storage } = options;

  const supabase = createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: storage,
    },
  });

  // Auth methods
  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async function signInWithGoogle(idToken: string) {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // Identity methods
  async function getIdentity(): Promise<Identity | null> {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('identities')
      .select('data')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data?.data || null;
  }

  async function saveIdentity(identity: Identity): Promise<void> {
    const user = await getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('identities')
      .upsert(
        {
          user_id: user.id,
          data: identity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  }

  // Context methods
  async function getRecentContext(options: ContextQueryOptions = {}): Promise<ContextEvent[]> {
    const user = await getUser();
    if (!user) return [];

    let query = supabase
      .from('context_events')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });

    if (options.type) query = query.eq('type', options.type);
    if (options.source) query = query.eq('source', options.source);
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function addContextEvent(event: ContextEventInput): Promise<ContextEvent> {
    const user = await getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('context_events')
      .insert({
        user_id: user.id,
        type: event.type,
        source: event.source,
        data: event.data,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Real-time subscriptions
  function subscribeToIdentityChanges(callback: (identity: Identity) => void): () => void {
    const channel = supabase
      .channel('identity-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'identities' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            callback((payload.new as { data: Identity }).data);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  function subscribeToContextChanges(callback: (event: ContextEvent) => void): () => void {
    const channel = supabase
      .channel('context-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'context_events' },
        (payload) => {
          callback(payload.new as ContextEvent);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  return {
    supabase,
    getUser,
    signInWithGoogle,
    signOut,
    getIdentity,
    saveIdentity,
    getRecentContext,
    addContextEvent,
    subscribeToIdentityChanges,
    subscribeToContextChanges,
  };
}
