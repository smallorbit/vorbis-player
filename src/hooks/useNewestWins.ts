import { useRef } from 'react';

/**
 * Newest-wins async guard.
 *
 * The single most recurring bug mechanism in this codebase is a superseded
 * async operation writing state after a newer one already won (collection
 * loads, radio generation, accent-color extraction, playback transitions).
 * Before this primitive existed the guard was hand-rolled 8+ times in three
 * idioms — a monotonic generation counter, a `let cancelled` flag, and a
 * bare AbortController — with at least one path shipping unguarded (F44).
 *
 * One guard instance protects one logical slot (e.g. "the queue's collection
 * load"). Each attempt claims a token via `begin()`; claiming aborts the
 * previous attempt's `signal` and makes its token stale. An attempt must
 * check `token.isStale()` after every `await` before writing state, and pass
 * `token.signal` to abortable fetches so superseded network work is cancelled
 * rather than raced.
 */

export interface NewestWinsToken {
  /** Monotonic id of this attempt; mostly useful for logging. */
  readonly generation: number;
  /** Aborted the moment a newer attempt begins or the guard is invalidated. */
  readonly signal: AbortSignal;
  /** True once a newer attempt has begun (or `invalidate()` was called). */
  readonly isStale: () => boolean;
}

export interface NewestWinsGuard {
  /** Claim the newest attempt. Aborts and stales every earlier token. */
  begin(): NewestWinsToken;
  /**
   * Stale every outstanding token without starting a new attempt — for
   * stop/teardown paths (e.g. "stop radio", unmount) where nothing newer
   * replaces the in-flight work but its result must still be dropped.
   */
  invalidate(): void;
}

/**
 * Non-hook factory for module-level owners (stores, module caches). Inside a
 * component, use {@link useNewestWins} instead.
 */
export function createNewestWins(): NewestWinsGuard {
  let generation = 0;
  let controller: AbortController | null = null;

  return {
    begin(): NewestWinsToken {
      controller?.abort();
      controller = new AbortController();
      generation += 1;
      const claimed = generation;
      return {
        generation: claimed,
        signal: controller.signal,
        isStale: () => generation !== claimed,
      };
    },
    invalidate(): void {
      controller?.abort();
      controller = null;
      generation += 1;
    },
  };
}

/** One stable newest-wins guard per component instance. */
export function useNewestWins(): NewestWinsGuard {
  const ref = useRef<NewestWinsGuard | null>(null);
  ref.current ??= createNewestWins();
  return ref.current;
}
