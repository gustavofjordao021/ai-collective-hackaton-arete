/**
 * Merged Context Tests - TDD RED phase
 *
 * Tests for merging local chrome.storage facts/pages with cloud Supabase context.
 * Follows patterns from src/supabase/context-sync.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome.storage.local BEFORE imports
const mockStorage: Record<string, unknown> = {};
const mockChromeStorage = {
  get: vi.fn((key: string | string[] | null) =>
    Promise.resolve(
      typeof key === 'string'
        ? { [key]: mockStorage[key] }
        : key === null
          ? mockStorage
          : Array.isArray(key)
            ? key.reduce(
                (acc, k) => ({ ...acc, [k]: mockStorage[k] }),
                {} as Record<string, unknown>
              )
            : {}
    )
  ),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(mockStorage, items);
    return Promise.resolve();
  }),
};

vi.stubGlobal('chrome', {
  storage: { local: mockChromeStorage },
});

// Mock auth module
const mockGetAuthState = vi.fn();
vi.mock('../supabase/auth', () => ({
  getAuthState: () => mockGetAuthState(),
}));

// Mock cloud functions
const mockLoadFactsFromCloud = vi.fn();
const mockLoadPagesFromCloud = vi.fn();
vi.mock('../supabase/context-sync', () => ({
  loadFactsFromCloud: () => mockLoadFactsFromCloud(),
  loadPagesFromCloud: () => mockLoadPagesFromCloud(),
}));

// Import AFTER mocks are set up
import {
  getMergedFacts,
  getMergedFactsForPrompt,
  getMergedBrowsingContext,
} from './merged-context';

describe('Merged Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    // Default: not authenticated
    mockGetAuthState.mockResolvedValue({ isAuthenticated: false, user: null });
    mockLoadFactsFromCloud.mockResolvedValue([]);
    mockLoadPagesFromCloud.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMergedFacts', () => {
    it('returns only local facts when not authenticated', async () => {
      // Setup: local storage has facts
      mockStorage['arete_facts_learned'] = [
        { fact: 'User prefers TypeScript', _timestamp: 1000 },
        { fact: 'User works at PayNearMe', _timestamp: 2000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: false });

      const facts = await getMergedFacts();

      expect(facts).toHaveLength(2);
      expect(facts).toContain('User prefers TypeScript');
      expect(facts).toContain('User works at PayNearMe');
      expect(mockLoadFactsFromCloud).not.toHaveBeenCalled();
    });

    it('merges local and cloud facts when authenticated', async () => {
      // Setup: local has 2 facts
      mockStorage['arete_facts_learned'] = [
        { fact: 'Local fact 1', _timestamp: 1000 },
        { fact: 'Local fact 2', _timestamp: 2000 },
      ];
      // Setup: cloud has 2 different facts
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadFactsFromCloud.mockResolvedValue([
        { fact: 'Cloud insight 1', _timestamp: 3000 },
        { fact: 'Cloud insight 2', _timestamp: 4000 },
      ]);

      const facts = await getMergedFacts();

      expect(facts).toHaveLength(4);
      expect(facts).toContain('Local fact 1');
      expect(facts).toContain('Cloud insight 1');
    });

    it('deduplicates similar facts using Jaccard similarity', async () => {
      // Setup: local and cloud have similar facts (>70% Jaccard similarity)
      // "User prefers TypeScript language" has 4 words
      // "User prefers TypeScript syntax" has 4 words, 3 overlap = 3/5 = 60% (not enough)
      // Need higher overlap: "User really prefers TypeScript" vs "User prefers TypeScript" = 3/4 = 75%
      mockStorage['arete_facts_learned'] = [
        { fact: 'User really prefers TypeScript', _timestamp: 1000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadFactsFromCloud.mockResolvedValue([
        { fact: 'User prefers TypeScript', _timestamp: 2000 }, // 75% similar, newer
      ]);

      const facts = await getMergedFacts();

      // Should dedupe, keeping newer cloud version
      expect(facts).toHaveLength(1);
      expect(facts[0]).toBe('User prefers TypeScript');
    });

    it('returns local facts when cloud fetch fails', async () => {
      mockStorage['arete_facts_learned'] = [
        { fact: 'Local fact', _timestamp: 1000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadFactsFromCloud.mockRejectedValue(new Error('Network error'));

      const facts = await getMergedFacts();

      expect(facts).toHaveLength(1);
      expect(facts[0]).toBe('Local fact');
    });

    it('respects character budget', async () => {
      // Setup: many facts exceeding budget
      mockStorage['arete_facts_learned'] = [
        { fact: 'A'.repeat(100), _timestamp: 1000 },
        { fact: 'B'.repeat(100), _timestamp: 2000 },
        { fact: 'C'.repeat(100), _timestamp: 3000 },
        { fact: 'D'.repeat(100), _timestamp: 4000 },
      ];

      const facts = await getMergedFacts(250); // Budget: 250 chars

      // Should fit only 2 facts (200 chars) within 250 budget
      expect(facts.length).toBeLessThanOrEqual(2);
      const totalChars = facts.join('').length;
      expect(totalChars).toBeLessThanOrEqual(250);
    });

    it('sorts facts by timestamp (newest first)', async () => {
      mockStorage['arete_facts_learned'] = [
        { fact: 'Oldest fact', _timestamp: 1000 },
        { fact: 'Newest fact', _timestamp: 3000 },
        { fact: 'Middle fact', _timestamp: 2000 },
      ];

      const facts = await getMergedFacts();

      expect(facts[0]).toBe('Newest fact');
      expect(facts[1]).toBe('Middle fact');
      expect(facts[2]).toBe('Oldest fact');
    });

    it('handles empty local and cloud facts', async () => {
      mockStorage['arete_facts_learned'] = [];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadFactsFromCloud.mockResolvedValue([]);

      const facts = await getMergedFacts();

      expect(facts).toHaveLength(0);
    });
  });

  describe('getMergedFactsForPrompt', () => {
    it('returns formatted string with facts', async () => {
      mockStorage['arete_facts_learned'] = [
        { fact: 'User is Brazilian', _timestamp: 1000 },
        { fact: 'User likes air fryer', _timestamp: 2000 },
      ];

      const prompt = await getMergedFactsForPrompt();

      expect(prompt).toContain('Learned about this user:');
      expect(prompt).toContain('- User is Brazilian');
      expect(prompt).toContain('- User likes air fryer');
    });

    it('returns empty string when no facts', async () => {
      mockStorage['arete_facts_learned'] = [];

      const prompt = await getMergedFactsForPrompt();

      expect(prompt).toBe('');
    });
  });

  describe('getMergedBrowsingContext', () => {
    it('returns only local pages when not authenticated', async () => {
      mockStorage['arete_context_pages'] = [
        { url: 'https://github.com', title: 'GitHub', hostname: 'github.com', timestamp: 1000 },
        { url: 'https://google.com', title: 'Google', hostname: 'google.com', timestamp: 2000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: false });

      const context = await getMergedBrowsingContext();

      expect(context).toContain('github.com');
      expect(context).toContain('google.com');
      expect(mockLoadPagesFromCloud).not.toHaveBeenCalled();
    });

    it('merges local and cloud pages when authenticated', async () => {
      mockStorage['arete_context_pages'] = [
        { url: 'https://github.com', title: 'GitHub', hostname: 'github.com', timestamp: 1000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadPagesFromCloud.mockResolvedValue([
        { url: 'https://stackoverflow.com', title: 'SO', hostname: 'stackoverflow.com', timestamp: 2000 },
      ]);

      const context = await getMergedBrowsingContext();

      expect(context).toContain('github.com');
      expect(context).toContain('stackoverflow.com');
    });

    it('deduplicates pages by URL, keeping most recent', async () => {
      mockStorage['arete_context_pages'] = [
        { url: 'https://github.com/old', title: 'Old', hostname: 'github.com', timestamp: 1000 },
      ];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadPagesFromCloud.mockResolvedValue([
        { url: 'https://github.com/old', title: 'New', hostname: 'github.com', timestamp: 2000 },
      ]);

      const context = await getMergedBrowsingContext();

      // Should only have github.com once
      const matches = context.match(/github\.com/g) || [];
      expect(matches.length).toBe(1);
    });

    it('returns empty string when no pages', async () => {
      mockStorage['arete_context_pages'] = [];
      mockGetAuthState.mockResolvedValue({ isAuthenticated: true, user: { id: 'test' } });
      mockLoadPagesFromCloud.mockResolvedValue([]);

      const context = await getMergedBrowsingContext();

      expect(context).toBe('');
    });

    it('limits to 5 unique hostnames', async () => {
      mockStorage['arete_context_pages'] = [
        { url: 'https://a.com', hostname: 'a.com', timestamp: 1 },
        { url: 'https://b.com', hostname: 'b.com', timestamp: 2 },
        { url: 'https://c.com', hostname: 'c.com', timestamp: 3 },
        { url: 'https://d.com', hostname: 'd.com', timestamp: 4 },
        { url: 'https://e.com', hostname: 'e.com', timestamp: 5 },
        { url: 'https://f.com', hostname: 'f.com', timestamp: 6 },
        { url: 'https://g.com', hostname: 'g.com', timestamp: 7 },
      ];

      const context = await getMergedBrowsingContext();

      // Count unique hostnames in output
      const hostnames = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com'];
      const included = hostnames.filter(h => context.includes(h));
      expect(included.length).toBeLessThanOrEqual(5);
    });
  });
});
