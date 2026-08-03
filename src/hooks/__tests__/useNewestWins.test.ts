import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createNewestWins, useNewestWins } from '@/hooks/useNewestWins';
import { deferred } from '@/test/asyncRace';

describe('createNewestWins', () => {
  it('a token starts fresh and only goes stale when a newer attempt begins', () => {
    // #given
    const guard = createNewestWins();

    // #when
    const first = guard.begin();

    // #then
    expect(first.isStale()).toBe(false);
    expect(first.signal.aborted).toBe(false);

    // #when — a newer attempt begins
    const second = guard.begin();

    // #then — the old token is stale and aborted; the new one is live
    expect(first.isStale()).toBe(true);
    expect(first.signal.aborted).toBe(true);
    expect(second.isStale()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.generation).toBeGreaterThan(first.generation);
  });

  it('invalidate() stales the outstanding token without starting a new attempt', () => {
    // #given
    const guard = createNewestWins();
    const token = guard.begin();

    // #when
    guard.invalidate();

    // #then
    expect(token.isStale()).toBe(true);
    expect(token.signal.aborted).toBe(true);

    // #when — a later begin() still works after invalidation
    const next = guard.begin();

    // #then
    expect(next.isStale()).toBe(false);
    expect(next.signal.aborted).toBe(false);
  });

  it('a stale attempt resolving late cannot win over the newer attempt', async () => {
    // #given — two overlapping "loads" writing to a shared slot, resolved out
    // of order (the race shape from src/test/asyncRace.ts)
    const guard = createNewestWins();
    let applied: string | null = null;

    const slow = deferred<string>();
    const fast = deferred<string>();

    async function load(dep: Promise<string>) {
      const token = guard.begin();
      const value = await dep;
      if (token.isStale()) return;
      applied = value;
    }

    const slowLoad = load(slow.promise);
    const fastLoad = load(fast.promise);

    // #when — newest resolves first, then the stale one resolves late
    fast.resolve('B');
    await fastLoad;
    slow.resolve('A');
    await slowLoad;

    // #then — the stale A never overwrites B
    expect(applied).toBe('B');
  });
});

describe('useNewestWins', () => {
  it('returns the same guard instance across re-renders', () => {
    // #given
    const { result, rerender } = renderHook(() => useNewestWins());
    const first = result.current;

    // #when
    rerender();

    // #then
    expect(result.current).toBe(first);
  });
});
