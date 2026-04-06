import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startCapture, stopCapture, getEntries, clearEntries } from '../consoleCapture';
import type { ConsoleEntry } from '../consoleCapture';

beforeEach(() => {
  stopCapture();
  clearEntries();
});

afterEach(() => {
  stopCapture();
  clearEntries();
});

describe('startCapture / stopCapture lifecycle', () => {
  it('returns an empty array when stopped without any calls', () => {
    // #when
    startCapture();
    const entries = stopCapture();

    // #then
    expect(entries).toEqual([]);
  });

  it('restores original console methods after stopCapture', () => {
    // #given
    const originalLog = console.log;
    startCapture();
    const patchedLog = console.log;

    // #when
    stopCapture();

    // #then
    expect(console.log).toBe(originalLog);
    expect(console.log).not.toBe(patchedLog);
  });

  it('does not capture entries after stopCapture', () => {
    // #given
    startCapture();
    stopCapture();

    // #when
    console.log('should not be captured');

    // #then
    expect(getEntries()).toEqual([]);
  });

  it('calling startCapture twice does not double-patch', () => {
    // #given
    startCapture();
    const firstPatch = console.log;

    // #when
    startCapture();

    // #then
    expect(console.log).toBe(firstPatch);

    stopCapture();
  });

  it('calling stopCapture when not capturing returns empty array', () => {
    // #when
    const entries = stopCapture();

    // #then
    expect(entries).toEqual([]);
  });

  it('clears buffer on stopCapture', () => {
    // #given
    startCapture();
    console.log('entry one');
    stopCapture();

    // #when
    startCapture();
    const entries = stopCapture();

    // #then
    expect(entries).toEqual([]);
  });
});

describe('console level interception', () => {
  const levels = ['log', 'warn', 'error', 'info', 'debug'] as const;

  for (const level of levels) {
    it(`captures console.${level} calls`, () => {
      // #given
      startCapture();

      // #when
      console[level]('test message');
      const entries = stopCapture();

      // #then
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(level);
      expect(entries[0].args[0]).toBe('test message');
    });
  }

  it('still calls through to the original console method', () => {
    // #given
    const spy = vi.fn();
    const origLog = console.log;
    console.log = spy;

    startCapture();

    // #when
    console.log('passthrough check');
    stopCapture();

    // #then
    expect(spy).toHaveBeenCalledWith('passthrough check');

    console.log = origLog;
  });
});

describe('entry shape', () => {
  it('records timestamp as an ISO 8601 string', () => {
    // #given
    startCapture();

    // #when
    console.log('ts check');
    const entries = stopCapture();

    // #then
    expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('records a stack trace string', () => {
    // #given
    startCapture();

    // #when
    console.log('stack check');
    const entries = stopCapture();

    // #then
    expect(typeof entries[0].stack).toBe('string');
  });

  it('serializes multiple arguments', () => {
    // #given
    startCapture();

    // #when
    console.log('first', 'second', 'third');
    const entries = stopCapture();

    // #then
    expect(entries[0].args).toEqual(['first', 'second', 'third']);
  });
});

describe('safe serialization', () => {
  it('handles circular references gracefully', () => {
    // #given
    const obj: Record<string, unknown> = { key: 'value' };
    obj.self = obj;

    startCapture();

    // #when
    console.log(obj);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toContain('[Circular]');
  });

  it('handles Error objects', () => {
    // #given
    const err = new Error('something went wrong');

    startCapture();

    // #when
    console.error(err);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toContain('Error');
    expect(entries[0].args[0]).toContain('something went wrong');
  });

  it('truncates very long strings', () => {
    // #given
    const longString = 'x'.repeat(2000);

    startCapture();

    // #when
    console.log(longString);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0].length).toBeLessThan(1100);
    expect(entries[0].args[0]).toContain('[truncated]');
  });

  it('handles null and undefined', () => {
    // #given
    startCapture();

    // #when
    console.log(null, undefined);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toBe('null');
    expect(entries[0].args[1]).toBe('undefined');
  });

  it('handles numbers and booleans', () => {
    // #given
    startCapture();

    // #when
    console.log(42, true, false);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toBe('42');
    expect(entries[0].args[1]).toBe('true');
    expect(entries[0].args[2]).toBe('false');
  });

  it('handles nested arrays', () => {
    // #given
    startCapture();

    // #when
    console.log([1, 2, [3, 4]]);
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toContain('1');
    expect(entries[0].args[0]).toContain('2');
    expect(entries[0].args[0]).toContain('3');
  });

  it('handles plain objects', () => {
    // #given
    startCapture();

    // #when
    console.log({ name: 'Alice', age: 30 });
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toContain('name');
    expect(entries[0].args[0]).toContain('Alice');
  });

  it('handles functions', () => {
    // #given
    startCapture();

    // #when
    console.log(function myFunc() {});
    const entries = stopCapture();

    // #then
    expect(entries[0].args[0]).toContain('Function');
    expect(entries[0].args[0]).toContain('myFunc');
  });
});

describe('getEntries', () => {
  it('returns current buffer contents without stopping capture', () => {
    // #given
    startCapture();
    console.log('entry one');
    console.warn('entry two');

    // #when
    const entries = getEntries();

    // #then
    expect(entries).toHaveLength(2);
    stopCapture();
  });

  it('returns an empty array before capture starts', () => {
    // #when
    const entries = getEntries();

    // #then
    expect(entries).toEqual([]);
  });
});

describe('clearEntries', () => {
  it('empties the buffer without stopping capture', () => {
    // #given
    startCapture();
    console.log('to be cleared');
    expect(getEntries()).toHaveLength(1);

    // #when
    clearEntries();

    // #then
    expect(getEntries()).toHaveLength(0);
    stopCapture();
  });

  it('allows new entries to be captured after clearing', () => {
    // #given
    startCapture();
    console.log('first');
    clearEntries();

    // #when
    console.log('second');
    const entries = stopCapture();

    // #then
    expect(entries).toHaveLength(1);
    expect(entries[0].args[0]).toBe('second');
  });
});

describe('circular buffer — 200 entry limit', () => {
  it('keeps only the most recent 200 entries', () => {
    // #given
    startCapture();

    // #when
    for (let i = 0; i < 250; i++) {
      console.log(`entry ${i}`);
    }
    const entries = stopCapture();

    // #then
    expect(entries).toHaveLength(200);
    expect(entries[0].args[0]).toBe('entry 50');
    expect(entries[199].args[0]).toBe('entry 249');
  });
});

describe('type contract', () => {
  it('ConsoleEntry has the expected shape', () => {
    // #given
    startCapture();
    console.info('type check');
    const entries = stopCapture();

    // #then
    const entry: ConsoleEntry = entries[0];
    expect(typeof entry.timestamp).toBe('string');
    expect(entry.level).toBe('info');
    expect(Array.isArray(entry.args)).toBe(true);
    expect(typeof entry.stack).toBe('string');
  });
});
