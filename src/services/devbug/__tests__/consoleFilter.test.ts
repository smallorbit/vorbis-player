import { describe, it, expect } from 'vitest';
import { filterConsoleByComponent, getComponentHierarchy } from '../consoleFilter';
import type { ConsoleEntry } from '../consoleCapture';
import type { FilterResult } from '../consoleFilter';

function makeEntry(stack: string, overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    timestamp: '2026-04-06T12:00:00.000Z',
    level: 'log',
    args: ['test message'],
    stack,
    ...overrides,
  };
}

describe('filterConsoleByComponent', () => {
  describe('exact component name matching', () => {
    it('matches entries whose stack contains the component name', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at PlayerContainer (PlayerContainer.tsx:42)'),
        makeEntry('Error\n    at unrelated (other.tsx:10)'),
      ];

      // #when
      const result: FilterResult = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].stack).toContain('PlayerContainer');
    });

    it('puts non-matching entries in unmatched', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at PlayerContainer (PlayerContainer.tsx:42)'),
        makeEntry('Error\n    at unrelated (other.tsx:10)'),
      ];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0].stack).toContain('unrelated');
    });
  });

  describe('fuzzy name matching', () => {
    it('matches camelCase variant of component name', () => {
      // #given
      const entries = [makeEntry('Error\n    at playerContainer (playerContainer.tsx:5)')];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(1);
    });

    it('matches kebab-case variant of component name', () => {
      // #given
      const entries = [makeEntry('Error\n    at player-container (player-container.tsx:5)')];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(1);
    });

    it('matches lowercase variant of component name', () => {
      // #given
      const entries = [makeEntry('Error\n    at playercontainer (playercontainer.tsx:5)')];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(1);
    });
  });

  describe('parent component matching', () => {
    it('matches entries that contain a parent component name', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at ChildComponent (child.tsx:10)\n    at ParentComponent (parent.tsx:20)'),
        makeEntry('Error\n    at unrelated (other.tsx:5)'),
      ];

      // #when
      const result = filterConsoleByComponent(entries, 'ChildComponent', ['ParentComponent']);

      // #then
      expect(result.matched).toHaveLength(1);
    });

    it('matches when only parent name appears but not primary component name', () => {
      // #given
      const entries = [makeEntry('Error\n    at ParentComponent (parent.tsx:20)')];

      // #when
      const result = filterConsoleByComponent(entries, 'ChildComponent', ['ParentComponent']);

      // #then
      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(0);
    });

    it('handles multiple parent names and matches any of them', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at GrandParent (grandparent.tsx:1)'),
        makeEntry('Error\n    at MiddleParent (middle.tsx:1)'),
        makeEntry('Error\n    at unrelated (other.tsx:1)'),
      ];

      // #when
      const result = filterConsoleByComponent(entries, 'ChildComponent', ['GrandParent', 'MiddleParent']);

      // #then
      expect(result.matched).toHaveLength(2);
      expect(result.unmatched).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns all entries as unmatched when no entries match', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at SomeComponent (some.tsx:1)'),
        makeEntry('Error\n    at AnotherComponent (another.tsx:1)'),
      ];

      // #when
      const result = filterConsoleByComponent(entries, 'NonExistentComponent');

      // #then
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(2);
    });

    it('returns empty arrays when entries array is empty', () => {
      // #when
      const result = filterConsoleByComponent([], 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
    });

    it('returns all matched when all entries contain the component name', () => {
      // #given
      const entries = [
        makeEntry('Error\n    at PlayerContainer (PlayerContainer.tsx:10)'),
        makeEntry('Error\n    at PlayerContainer (PlayerContainer.tsx:42)'),
      ];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.matched).toHaveLength(2);
      expect(result.unmatched).toHaveLength(0);
    });

    it('handles empty stack strings without throwing', () => {
      // #given
      const entries = [makeEntry('')];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer');

      // #then
      expect(result.unmatched).toHaveLength(1);
      expect(result.matched).toHaveLength(0);
    });

    it('handles parentNames as undefined (no crash)', () => {
      // #given
      const entries = [makeEntry('Error\n    at PlayerContainer (PlayerContainer.tsx:1)')];

      // #when
      const result = filterConsoleByComponent(entries, 'PlayerContainer', undefined);

      // #then
      expect(result.matched).toHaveLength(1);
    });
  });

  describe('result structure', () => {
    it('returns a FilterResult with matched and unmatched arrays', () => {
      // #when
      const result = filterConsoleByComponent([], 'Component');

      // #then
      expect(result).toHaveProperty('matched');
      expect(result).toHaveProperty('unmatched');
      expect(Array.isArray(result.matched)).toBe(true);
      expect(Array.isArray(result.unmatched)).toBe(true);
    });

    it('preserves entry data in matched entries', () => {
      // #given
      const entry = makeEntry('Error\n    at TrackList (TrackList.tsx:7)', {
        level: 'error',
        args: ['something broke'],
        timestamp: '2026-01-01T00:00:00.000Z',
      });

      // #when
      const result = filterConsoleByComponent([entry], 'TrackList');

      // #then
      expect(result.matched[0]).toStrictEqual(entry);
    });
  });
});

describe('getComponentHierarchy', () => {
  it('returns empty array when element has no React fiber', () => {
    // #given
    const el = document.createElement('div');

    // #when
    const hierarchy = getComponentHierarchy(el);

    // #then
    expect(hierarchy).toEqual([]);
  });

  it('returns component names from fiber when React fiber is present', () => {
    // #given
    const el = document.createElement('div');
    const fiberKey = '__reactFiber$testkey';

    function PlayerContainer() {}
    function AudioPlayer() {}

    const fiber = {
      type: PlayerContainer,
      return: {
        type: AudioPlayer,
        return: null,
      },
    };

    (el as unknown as Record<string, unknown>)[fiberKey] = fiber;

    // #when
    const hierarchy = getComponentHierarchy(el);

    // #then
    expect(hierarchy).toContain('PlayerContainer');
    expect(hierarchy).toContain('AudioPlayer');
  });

  it('uses displayName when type is an object with displayName', () => {
    // #given
    const el = document.createElement('div');
    const fiberKey = '__reactFiber$testkey';

    const fiber = {
      type: { displayName: 'MyForwardedComponent' },
      return: null,
    };

    (el as unknown as Record<string, unknown>)[fiberKey] = fiber;

    // #when
    const hierarchy = getComponentHierarchy(el);

    // #then
    expect(hierarchy).toContain('MyForwardedComponent');
  });

  it('skips fiber nodes with no named type', () => {
    // #given
    const el = document.createElement('div');
    const fiberKey = '__reactFiber$testkey';

    function NamedComponent() {}

    const fiber = {
      type: 'div',
      return: {
        type: NamedComponent,
        return: null,
      },
    };

    (el as unknown as Record<string, unknown>)[fiberKey] = fiber;

    // #when
    const hierarchy = getComponentHierarchy(el);

    // #then
    expect(hierarchy).toContain('NamedComponent');
    expect(hierarchy).not.toContain('div');
  });

  it('supports __reactInternalInstance$ fiber key prefix', () => {
    // #given
    const el = document.createElement('div');
    const fiberKey = '__reactInternalInstance$testkey';

    function LegacyComponent() {}

    const fiber = {
      type: LegacyComponent,
      return: null,
    };

    (el as unknown as Record<string, unknown>)[fiberKey] = fiber;

    // #when
    const hierarchy = getComponentHierarchy(el);

    // #then
    expect(hierarchy).toContain('LegacyComponent');
  });
});
