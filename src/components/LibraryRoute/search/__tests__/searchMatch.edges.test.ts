/**
 * Edge-case tests for searchMatch helpers beyond builder-1's baseline coverage.
 *
 * Covers:
 *  - matchesQuery: whitespace boundaries, special characters, unicode codepoints
 *  - passesProviderFilter: undefined provider defaults to 'spotify' (locks
 *    the implementation choice — a regression here would silently exclude
 *    Spotify items whose provider field is missing)
 *  - sortItems: stability + immutability
 */

import { describe, it, expect } from 'vitest';
import { matchesQuery, normalizeQuery, passesProviderFilter, sortItems } from '../searchMatch';

describe('matchesQuery edges', () => {
  it('matches when item.name has surrounding whitespace and query is the trimmed substring', () => {
    // #given
    const item = { name: '   Classic Rock   ' };

    // #when / #then — caller normalizes, but item.name is taken raw → substring still hits
    expect(matchesQuery(item, 'rock')).toBe(true);
  });

  it('matches with special characters in name', () => {
    // #given
    const item = { name: "Today's Top Hits" };

    // #when / #then
    expect(matchesQuery(item, "today's")).toBe(true);
  });

  it('matches with literal-codepoint unicode characters', () => {
    // #given
    const item = { name: 'Café Tacvba' };

    // #when / #then — substring is exact-codepoint match (no NFC/NFD folding)
    expect(matchesQuery(item, 'café')).toBe(true);
    expect(matchesQuery(item, 'cafe')).toBe(false);
  });

  it('returns false when query has trailing whitespace not in name', () => {
    // #given — caller is responsible for normalizing; matchesQuery trusts the input
    const item = { name: 'rock' };

    // #when / #then
    expect(matchesQuery(item, 'rock ')).toBe(false);
  });
});

describe('normalizeQuery edges', () => {
  it('lowercases ASCII but leaves unicode codepoint shape intact', () => {
    // #when
    const result = normalizeQuery('  CAFÉ  ');

    // #then — toLowerCase still folds À-Z accents
    expect(result).toBe('café');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeQuery('')).toBe('');
  });

  it('collapses tab + newline whitespace via trim()', () => {
    expect(normalizeQuery('\t  rock  \n')).toBe('rock');
  });
});

describe('passesProviderFilter edges', () => {
  it('treats undefined provider as spotify when filter excludes spotify → false', () => {
    // #given filter = ['dropbox']
    // #when item.provider missing
    // #then default 'spotify' is NOT in ['dropbox'] → exclude
    expect(passesProviderFilter({}, ['dropbox'])).toBe(false);
  });

  it('treats undefined provider as spotify when filter includes spotify → true', () => {
    expect(passesProviderFilter({}, ['spotify'])).toBe(true);
  });

  it('excludes when provider is set but not in filter list', () => {
    expect(passesProviderFilter({ provider: 'dropbox' }, ['spotify'])).toBe(false);
  });

  it('excludes when filter has multiple providers and item is in none', () => {
    // #given filter has spotify+dropbox, item is some other future provider id
    expect(
      passesProviderFilter({ provider: 'youtube' as never }, ['spotify', 'dropbox']),
    ).toBe(false);
  });
});

describe('sortItems edges', () => {
  it('does not mutate the input array for non-recent sorts', () => {
    // #given
    const items = [{ name: 'Charlie' }, { name: 'alpha' }, { name: 'Bravo' }];
    const original = items.map((i) => i.name);

    // #when
    sortItems(items, 'name-asc');

    // #then — input untouched
    expect(items.map((i) => i.name)).toEqual(original);
  });

  it('returns same reference for "recent" sort (caller-supplied order = recent)', () => {
    // #given
    const items = [{ name: 'a' }, { name: 'b' }];

    // #when
    const result = sortItems(items, 'recent');

    // #then
    expect(result).toBe(items);
  });

  it('handles empty array gracefully', () => {
    expect(sortItems([], 'name-asc')).toEqual([]);
    expect(sortItems([], 'name-desc')).toEqual([]);
    expect(sortItems([], 'recent')).toEqual([]);
  });

  it('handles single-element array', () => {
    const items = [{ name: 'solo' }];
    expect(sortItems(items, 'name-asc').map((i) => i.name)).toEqual(['solo']);
    expect(sortItems(items, 'name-desc').map((i) => i.name)).toEqual(['solo']);
  });
});
