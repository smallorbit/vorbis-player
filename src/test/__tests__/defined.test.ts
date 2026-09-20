import { describe, it, expect } from 'vitest';
import { defined } from '../defined';

describe('defined', () => {
  it('returns the value when it is present', () => {
    expect(defined('ok')).toBe('ok');
    expect(defined(0)).toBe(0);
  });

  it('throws when the value is undefined', () => {
    expect(() => defined(undefined)).toThrow('expected value to be defined');
    expect(() => defined(undefined, 'missing item')).toThrow('missing item');
  });
});
