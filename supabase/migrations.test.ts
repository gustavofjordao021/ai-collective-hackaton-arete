/**
 * Tests for Supabase migrations
 *
 * These tests verify:
 * 1. All migration files exist and are valid SQL
 * 2. Expected tables, policies, and indexes are defined
 * 3. RLS is enabled on all user-facing tables
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

describe('Supabase Migrations', () => {
  let migrations: { name: string; content: string }[];

  beforeAll(() => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    migrations = files.map(name => ({
      name,
      content: readFileSync(join(MIGRATIONS_DIR, name), 'utf-8'),
    }));
  });

  it('should have migrations in correct order', () => {
    const names = migrations.map(m => m.name);
    expect(names).toEqual([
      '00001_create_profiles.sql',
      '00002_create_identities.sql',
      '00003_create_context_events.sql',
      '00004_enable_realtime.sql',
    ]);
  });

  describe('00001_create_profiles.sql', () => {
    let sql: string;

    beforeAll(() => {
      sql = migrations.find(m => m.name.includes('profiles'))!.content;
    });

    it('should create profiles table', () => {
      expect(sql).toContain('create table if not exists public.profiles');
    });

    it('should reference auth.users', () => {
      expect(sql).toContain('references auth.users(id)');
    });

    it('should enable RLS', () => {
      expect(sql).toContain('enable row level security');
    });

    it('should create select policy for own profile', () => {
      expect(sql).toContain('auth.uid() = id');
      expect(sql).toContain('for select');
    });

    it('should create trigger for new user signup', () => {
      expect(sql).toContain('handle_new_user');
      expect(sql).toContain('after insert on auth.users');
    });
  });

  describe('00002_create_identities.sql', () => {
    let sql: string;

    beforeAll(() => {
      sql = migrations.find(m => m.name.includes('identities'))!.content;
    });

    it('should create identities table', () => {
      expect(sql).toContain('create table if not exists public.identities');
    });

    it('should have jsonb data column', () => {
      expect(sql).toContain('data jsonb');
    });

    it('should enforce unique user_id', () => {
      expect(sql).toContain('unique(user_id)');
    });

    it('should enable RLS', () => {
      expect(sql).toContain('enable row level security');
    });

    it('should have CRUD policies for own identity', () => {
      expect(sql).toContain('for select');
      expect(sql).toContain('for insert');
      expect(sql).toContain('for update');
      expect(sql).toContain('for delete');
    });

    it('should update updated_at on changes', () => {
      expect(sql).toContain('update_updated_at');
      expect(sql).toContain('before update');
    });
  });

  describe('00003_create_context_events.sql', () => {
    let sql: string;

    beforeAll(() => {
      sql = migrations.find(m => m.name.includes('context_events'))!.content;
    });

    it('should create context_events table', () => {
      expect(sql).toContain('create table if not exists public.context_events');
    });

    it('should validate event types', () => {
      expect(sql).toContain("type in ('page_visit', 'selection', 'conversation', 'insight', 'file')");
    });

    it('should have source and data columns', () => {
      expect(sql).toContain('source text not null');
      expect(sql).toContain('data jsonb');
    });

    it('should enable RLS', () => {
      expect(sql).toContain('enable row level security');
    });

    it('should have efficient indexes', () => {
      expect(sql).toContain('context_events_user_timestamp_idx');
      expect(sql).toContain('context_events_user_type_idx');
      expect(sql).toContain('context_events_user_source_idx');
    });
  });

  describe('00004_enable_realtime.sql', () => {
    let sql: string;

    beforeAll(() => {
      sql = migrations.find(m => m.name.includes('realtime'))!.content;
    });

    it('should enable realtime for identities', () => {
      expect(sql).toContain('add table identities');
    });

    it('should enable realtime for context_events', () => {
      expect(sql).toContain('add table context_events');
    });
  });
});
