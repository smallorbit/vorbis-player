import { describe, it, expect } from 'vitest';
import { normalizeQuery, matchesQuery, passesProviderFilter, sortItems } from '../searchMatch';

describe('normalizeQuery', () => {
  it('trims and lowercases', () => {
    // #when
    const result = normalizeQuery('  Rock  ');

    // #then
    expect(result).toBe('rock');
  });

  it('returns empty for whitespace', () => {
    // #when
    const result = normalizeQuery('   ');

    // #then
    expect(result).toBe('');
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitive substring', () => {
    // #given
    const item = { name: 'Classic Rock' };

    // #when / #then
    expect(matchesQuery(item, 'rock')).toBe(true);
  });

  it('does not match when needle has different casing than haystack but normalized form differs', () => {
    // #given — caller is responsible for normalizing the query before passing it in
    const item = { name: 'classic rock' };

    // #when / #then — passing un-normalized 'CLASSIC' must NOT match (lowercase haystack only)
    expect(matchesQuery(item, 'CLASSIC')).toBe(false);
  });

  it('returns true for empty query', () => {
    // #given
    const item = { name: 'anything' };

    // #when / #then
    expect(matchesQuery(item, '')).toBe(true);
  });

  it('returns false on no match', () => {
    // #given
    const item = { name: 'Jazz' };

    // #when / #then
    expect(matchesQuery(item, 'rock')).toBe(false);
  });
});

describe('passesProviderFilter', () => {
  it('passes everything when filter is empty', () => {
    // #when / #then
    expect(passesProviderFilter({ provider: 'spotify' }, [])).toBe(true);
    expect(passesProviderFilter({}, [])).toBe(true);
  });

  it('passes only items in filter list', () => {
    // #when / #then
    expect(passesProviderFilter({ provider: 'spotify' }, ['spotify'])).toBe(true);
    expect(passesProviderFilter({ provider: 'dropbox' }, ['spotify'])).toBe(false);
  });

  it('treats missing provider as spotify', () => {
    // #when / #then
    expect(passesProviderFilter({}, ['spotify'])).toBe(true);
    expect(passesProviderFilter({}, ['dropbox'])).toBe(false);
  });
});

describe('sortItems', () => {
  const items = [
    { name: 'Charlie' },
    { name: 'alpha' },
    { name: 'Bravo' },
  ];

  it('returns items unchanged for recent sort', () => {
    // #when
    const result = sortItems(items, 'recent');

    // #then — same reference (caller-supplied order = "recent")
    expect(result).toBe(items);
  });

  it('sorts ascending by name (case-insensitive via localeCompare)', () => {
    // #when
    const result = sortItems(items, 'name-asc');

    // #then
    expect(result.map((i) => i.name)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('sorts descending by name', () => {
    // #when
    const result = sortItems(items, 'name-desc');

    // #then
    expect(result.map((i) => i.name)).toEqual(['Charlie', 'Bravo', 'alpha']);
  });
});
