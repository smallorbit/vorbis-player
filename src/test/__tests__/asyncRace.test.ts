import { describe, it, expect, vi } from 'vitest';
import { deferred, createDeferredFn, flushMicrotasks } from '../asyncRace';

describe('deferred', () => {
  it('resolves with the provided value', async () => {
    // #given a deferred
    const d = deferred<number>();
    expect(d.settled).toBe(false);

    // #when resolved
    d.resolve(42);

    // #then it settles and yields the value
    expect(d.settled).toBe(true);
    await expect(d.promise).resolves.toBe(42);
  });

  it('rejects with the provided reason', async () => {
    // #given a deferred
    const d = deferred<number>();

    // #when rejected
    d.reject(new Error('boom'));

    // #then it settles rejected
    expect(d.settled).toBe(true);
    await expect(d.promise).rejects.toThrow('boom');
  });
});

describe('createDeferredFn', () => {
  it('records each invocation with its args, in call order', () => {
    // #given an injected deferred fn
    const load = createDeferredFn<[string], string[]>();

    // #when invoked twice
    void load.fn('A');
    void load.fn('B');

    // #then calls are recorded in order
    expect(load.callCount).toBe(2);
    expect(load.calls[0]?.args).toEqual(['A']);
    expect(load.calls[1]?.args).toEqual(['B']);
  });

  it('lets the test settle calls OUT OF ORDER', async () => {
    // This is the core capability: model a superseded async load. Operation A
    // starts, operation B supersedes it, B resolves first, then the stale A
    // resolves late. A consumer that guards correctly keeps B's result.
    const load = createDeferredFn<[string], string>();

    // #given two in-flight loads and a "latest wins" consumer guarded by
    // request order (the shape every fixed race path uses)
    let latestRequested = '';
    let committed = '';
    const request = async (id: string) => {
      latestRequested = id;
      const result = await load.fn(id);
      // Guard: only commit if this request is still the latest.
      if (latestRequested === id) committed = result;
    };

    void request('A'); // call 0
    void request('B'); // call 1 — supersedes A

    // #when the newer load (B) resolves first, then the stale one (A) resolves
    load.resolve(1, 'result-B');
    await flushMicrotasks();
    load.resolve(0, 'result-A'); // stale — arrives after B
    await flushMicrotasks();

    // #then the stale A must not have overwritten B
    expect(committed).toBe('result-B');
  });

  it('demonstrates the bug a missing guard would cause', async () => {
    // Same interleaving, but WITHOUT the latest-wins guard — the stale write
    // clobbers the newer result. This is the failure the harness is built to catch.
    const load = createDeferredFn<[string], string>();

    let committed = '';
    const requestUnguarded = async (id: string) => {
      const result = await load.fn(id);
      committed = result; // no guard — always writes
    };

    void requestUnguarded('A');
    void requestUnguarded('B');

    load.resolve(1, 'result-B');
    await flushMicrotasks();
    load.resolve(0, 'result-A');
    await flushMicrotasks();

    // The stale A clobbered B — exactly the class of bug (#1638, #1651, #1336, …).
    expect(committed).toBe('result-A');
  });

  it('throws a helpful error when settling a non-existent call', () => {
    const load = createDeferredFn<[], void>();
    expect(() => load.resolve(0, undefined)).toThrow(/no call at index 0/);
  });
});

describe('flushMicrotasks', () => {
  it('runs queued microtasks before resolving', async () => {
    const order: string[] = [];
    void Promise.resolve().then(() => order.push('microtask'));
    order.push('sync');

    await flushMicrotasks();

    expect(order).toEqual(['sync', 'microtask']);
  });

  it('is a no-op-safe await point', async () => {
    const spy = vi.fn();
    await flushMicrotasks();
    spy();
    expect(spy).toHaveBeenCalledOnce();
  });
});
