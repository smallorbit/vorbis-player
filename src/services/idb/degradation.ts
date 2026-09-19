/**
 * Single IndexedDB degradation policy (#1702 / F35):
 *
 *   retry once → evict-and-retry on quota → deleteDatabase on corruption
 *
 * Callers must not flip the whole DB into a permanent memory fallback after a
 * write failure — that would hide still-readable on-disk data.
 */

import { logCaughtError } from '@/utils/logCaughtError';
import type { IdbErrorKind } from './types';

export function classifyIdbError(err: unknown): IdbErrorKind {
  if (err == null) return 'unknown';

  const name =
    err instanceof DOMException
      ? err.name
      : typeof err === 'object' && err !== null && 'name' in err && typeof (err as { name: unknown }).name === 'string'
        ? (err as { name: string }).name
        : '';

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : String(err);

  const haystack = `${name} ${message}`.toLowerCase();

  if (
    name === 'QuotaExceededError' ||
    haystack.includes('quotaexceeded') ||
    haystack.includes('quota exceeded')
  ) {
    return 'quota';
  }

  // Closed connection / versionchange — common, not corrupt. Retry (with reopen).
  if (name === 'InvalidStateError') {
    return 'transient';
  }

  // Reserve deleteDatabase for explicit corruption signals only.
  // Bare UnknownError without a corrupt/internal message is treated as unknown
  // (retry once) rather than wiping a healthy DB.
  if (
    haystack.includes('corrupt') ||
    haystack.includes('database disrupted') ||
    (name === 'UnknownError' && haystack.includes('internal error'))
  ) {
    return 'corruption';
  }

  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    name === 'NetworkError' ||
    haystack.includes('temporarily unavailable')
  ) {
    return 'transient';
  }

  return 'unknown';
}

export interface DegradationContext {
  readonly label: string;
  /** Clear quota-evictable object-store contents (connection may stay open). */
  readonly evictForQuota: () => Promise<void>;
  /** `deleteDatabase` + reopen so a later retry can succeed. */
  readonly recoverFromCorruption: () => Promise<void>;
  /**
   * Re-open the connection without deleting data. Used for transient failures
   * such as `InvalidStateError` after `onversionchange` closed the handle.
   */
  readonly reopenConnection?: (() => Promise<void>) | undefined;
}

export type DegradationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

/**
 * Run a write (or other mutating) operation under the shared policy.
 * Returns `{ ok: false }` after exhausting recoveries — never throws for
 * classified IDB failures; the caller decides soft-fail vs rethrow.
 */
export async function runWithDegradationPolicy<T>(
  ctx: DegradationContext,
  operation: () => Promise<T>,
): Promise<DegradationResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (firstErr) {
    const kind = classifyIdbError(firstErr);
    logCaughtError(`${ctx.label}.first`, firstErr);

    try {
      if (kind === 'quota') {
        await ctx.evictForQuota();
      } else if (kind === 'corruption') {
        await ctx.recoverFromCorruption();
      } else if (ctx.reopenConnection) {
        // transient / unknown: reopen in case the handle was closed, then retry
        await ctx.reopenConnection();
      }
      return { ok: true, value: await operation() };
    } catch (retryErr) {
      logCaughtError(`${ctx.label}.retry`, retryErr);
      return { ok: false, error: retryErr };
    }
  }
}
