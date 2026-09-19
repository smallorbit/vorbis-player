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

  // Chromium / Firefox / Safari corruption-ish signals seen in the wild.
  if (
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    haystack.includes('corrupt') ||
    haystack.includes('internal error') ||
    haystack.includes('database disrupted')
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
  /** Clear object-store contents to free quota (connection may stay open). */
  readonly evictForQuota: () => Promise<void>;
  /** `deleteDatabase` + reopen so a later retry can succeed. */
  readonly recoverFromCorruption: () => Promise<void>;
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
      }
      // transient / unknown: bare retry once
      return { ok: true, value: await operation() };
    } catch (retryErr) {
      logCaughtError(`${ctx.label}.retry`, retryErr);
      return { ok: false, error: retryErr };
    }
  }
}
