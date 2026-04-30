
import { describe, it, expect } from 'vitest';
import { sortKeysDeep } from '../sort-keys.ts';

describe('sortKeysDeep', () => {
  it('sorts object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = sortKeysDeep(input);
    expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
  });

  it('sorts keys recursively', () => {
    const input = { z: { b: 1, a: 2 }, a: { d: 3, c: 4 } };
    const result = sortKeysDeep(input);
    expect(Object.keys(result)).toEqual(['a', 'z']);
    expect(Object.keys(result.a)).toEqual(['c', 'd']);
    expect(Object.keys(result.z)).toEqual(['a', 'b']);
  });

  it('does not reorder arrays', () => {
    const input = { items: [3, 1, 2] };
    const result = sortKeysDeep(input);
    expect(result.items).toEqual([3, 1, 2]);
  });

  it('sorts keys in objects inside arrays', () => {
    const input = { items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] };
    const result = sortKeysDeep(input);
    expect(Object.keys(result.items[0]!)).toEqual(['a', 'b']);
    expect(Object.keys(result.items[1]!)).toEqual(['c', 'd']);
  });

  it('is idempotent', () => {
    const input = { a: { x: 1, b: 2 }, z: [{ q: 3, p: 4 }] };
    const once = sortKeysDeep(input);
    const twice = sortKeysDeep(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('passes through primitives unchanged', () => {
    expect(sortKeysDeep(42)).toBe(42);
    expect(sortKeysDeep('hello')).toBe('hello');
    expect(sortKeysDeep(null)).toBe(null);
    expect(sortKeysDeep(true)).toBe(true);
  });

  it('handles empty objects and arrays', () => {
    expect(sortKeysDeep({})).toEqual({});
    expect(sortKeysDeep([])).toEqual([]);
  });
});
