import { saveSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const PARAM = 'mock-session';

/**
 * Reads `?mock-session=<base64-json>` from the URL and writes the decoded
 * SessionSnapshot to localStorage so the production hydrate path picks it up
 * on first render. The URL value must be URL-encoded (e.g. via encodeURIComponent).
 *
 * Returns the decoded snapshot, or null if the param is absent or invalid.
 */
export function seedMockSession(): SessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = new URL(window.location.href).searchParams.get(PARAM);
  if (!raw) return null;
  try {
    const json = atob(raw);
    const parsed = JSON.parse(json) as unknown;
    if (!isSessionSnapshot(parsed)) {
      console.warn('[MockProvider] mock-session param is not a valid SessionSnapshot — ignored');
      return null;
    }
    saveSession(parsed);
    return parsed;
  } catch {
    console.warn('[MockProvider] Failed to decode mock-session param — ignored');
    return null;
  }
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.collectionId === 'string' &&
    typeof v.collectionName === 'string' &&
    typeof v.trackIndex === 'number'
  );
}
