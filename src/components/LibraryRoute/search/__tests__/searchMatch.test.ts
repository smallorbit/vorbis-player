import { describe, it, expect } from 'vitest';
import { normalizeQuery, matchesQuery, passesProviderFilter, sortItems } from '../searchMatch';

describe('normalizeQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeQuery('  Rock  ')).toBe('rock');
  });

  it('returns empty for whitespace', () => {
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitive substring', () => {
    expect(matchesQuery({ name: 'Classic Rock' }, 'rock')).toBe(true);
    expect(matchesQuery({ name: 'classic rock' }, 'CLASSIC')).toBe(false);
  });

  it('returns true for empty query', () => {
    expect(matchesQuery({ name: 'anything' }, '')).toBe(true);
  });

  it('returns false on no match', () => {
    expect(matchesQuery({ name: 'Jazz' }, 'rock')).toBe(false);
  });
});

describe('passesProviderFilter', () => {
  it('passes everything when filter is empty', () => {
    expect(passesProviderFilter({ provider: 'spotify' }, [])).toBe(true);
    expect(passesProviderFilter({}, [])).toBe(true);
  });

  it('passes only items in filter list', () => {
    expect(passesProviderFilter({ provider: 'spotify' }, ['spotify'])).toBe(true);
    expect(passesProviderFilter({ provider: 'dropbox' }, ['spotify'])).toBe(false);
  });

  it('treats missing provider as spotify', () => {
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
    expect(sortItems(items, 'recent')).toBe(items);
  });

  it('sorts ascending by name (case-insensitive via localeCompare)', () => {
    expect(sortItems(items, 'name-asc').map((i) => i.name)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('sorts descending by name', () => {
    expect(sortItems(items, 'name-desc').map((i) => i.name)).toEqual(['Charlie', 'Bravo', 'alpha']);
  });
});
