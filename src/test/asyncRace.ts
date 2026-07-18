/**
 * Utilities for testing stale-async-write / cancellation-race bugs — the single
 * most recurring bug mechanism in this codebase (superseded async loads writing
 * state after a newer one already won: collection loader, album art, library
 * sync, shuffle, playback subscription guard).
 *
 * The pattern these enable:
 *   1. Trigger operation A (it awaits some async dependency).
 *   2. Trigger operation B (supersedes A).
 *   3. Resolve the dependencies OUT OF ORDER — B first, then the stale A.
 *   4. Assert the final state reflects B, and that A's late resolution did NOT
 *      overwrite it.
 *
 * A single boundingBox-style "resolve in call order" test never exercises step 3,
 * which is exactly where these bugs live.
 */

/** A promise whose settlement the test controls explicitly. */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  /** True once resolve() or reject() has been called. */
  readonly settled: boolean;
}

/** Create a promise that the test resolves/rejects on demand. */
export function deferred<T = void>(): Deferred<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  let isSettled = false;

  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  return {
    promise,
    resolve: (value: T) => {
      isSettled = true;
      resolveFn(value);
    },
    reject: (reason?: unknown) => {
      isSettled = true;
      rejectFn(reason);
    },
    get settled() {
      return isSettled;
    },
  };
}

/**
 * A function you inject in place of an async dependency. Every invocation returns
 * a fresh, unresolved promise; the test settles each call by index, in any order.
 *
 *   const load = createDeferredFn<[collectionId: string], Track[]>();
 *   render(<Thing loader={load.fn} />);
 *   // component calls load.fn('A') then load.fn('B')
 *   load.resolve(1, tracksB);   // newer wins first
 *   load.resolve(0, tracksA);   // stale A resolves late — must NOT overwrite B
 */
export interface DeferredFn<Args extends unknown[], T> {
  /** Inject this where the real async dependency goes. */
  readonly fn: (...args: Args) => Promise<T>;
  /** One entry per invocation, in call order. */
  readonly calls: ReadonlyArray<{ readonly args: Args; readonly deferred: Deferred<T> }>;
  /** Number of times fn has been invoked. */
  readonly callCount: number;
  /** Resolve the i-th invocation's promise. */
  resolve: (index: number, value: T) => void;
  /** Reject the i-th invocation's promise. */
  reject: (index: number, reason?: unknown) => void;
}

export function createDeferredFn<Args extends unknown[], T>(): DeferredFn<Args, T> {
  const calls: Array<{ args: Args; deferred: Deferred<T> }> = [];

  const at = (index: number) => {
    const call = calls[index];
    if (!call) {
      throw new Error(
        `createDeferredFn: no call at index ${index} (only ${calls.length} call(s) so far)`,
      );
    }
    return call;
  };

  return {
    fn: (...args: Args): Promise<T> => {
      const d = deferred<T>();
      calls.push({ args, deferred: d });
      return d.promise;
    },
    get calls() {
      return calls;
    },
    get callCount() {
      return calls.length;
    },
    resolve: (index: number, value: T) => at(index).deferred.resolve(value),
    reject: (index: number, reason?: unknown) => at(index).deferred.reject(reason),
  };
}

/**
 * Flush pending microtasks so awaited continuations run before assertions.
 * Prefer React Testing Library's `waitFor` inside components; use this for
 * plain-promise / service-level races where there is no DOM to poll.
 */
export function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}
