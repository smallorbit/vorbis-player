import type { MediaTrack, ProviderId } from '@/types/domain';

/**
 * Typed window CustomEvent registry (Architecture v2 WS3 / F70).
 *
 * All app-owned CustomEvent names live here. `dispatchAppEvent` / `onAppEvent`
 * own the single sanctioned `detail` cast — call sites must not mint event
 * name strings or cast `CustomEvent` details themselves.
 *
 * `AUTH_COMPLETE_EVENT` is a postMessage `data.type` (popup → opener), not a
 * window CustomEvent, so it is intentionally outside `AppEventMap`.
 */

/** postMessage `data.type` from the OAuth popup when auth finishes. */
export const AUTH_COMPLETE_EVENT = 'vorbis-auth-complete' as const;

export const SESSION_EXPIRED_EVENT = 'vorbis-session-expired' as const;
export const PROVIDER_RECONNECTED_EVENT = 'vorbis-provider-reconnected' as const;
/** Active provider lost auth; playback switched to a still-authenticated fallback. */
export const PROVIDER_SESSION_FALLTHROUGH_EVENT = 'vorbis-provider-session-fallthrough' as const;
/** Provider was force-disabled because its session expired (no automatic switch). */
export const PROVIDER_DISCONNECTED_EVENT = 'vorbis-provider-disconnected' as const;
export const LOCAL_STORAGE_CHANGE_EVENT = 'vorbis-local-storage-change' as const;
export const AUTH_STATE_CHANGED_EVENT = 'vorbis-auth-state-changed' as const;
export const DROPBOX_AUTH_ERROR_EVENT = 'vorbis-dropbox-auth-error' as const;
export const DROPBOX_LIKES_CHANGED_EVENT = 'vorbis-dropbox-likes-changed' as const;
export const ART_REFRESHED_EVENT = 'vorbis-art-refreshed' as const;
export const LIBRARY_REFRESH_EVENT = 'vorbis-library-refresh' as const;
export const UNIFIED_LIKED_CACHE_UPDATED_EVENT = 'vorbis-unified-liked-cache-updated' as const;
export const PINS_CHANGED_EVENT = 'vorbis-pins-changed' as const;
export const MOCK_SET_QUEUE_EVENT = 'mock:set-queue' as const;
export const MOCK_RESET_EVENT = 'mock:reset' as const;
export const MOCK_DROPBOX_LIKES_CHANGED_EVENT = 'mock-dropbox-likes-changed' as const;

export interface ProviderScopedDetail {
  providerId: ProviderId;
}

export interface ProviderDisconnectedDetail {
  providerId: ProviderId;
  providerName: string;
}

export interface ProviderSessionFallthroughDetail {
  expiredProviderId: ProviderId;
  expiredProviderName: string;
  fallbackProviderId: ProviderId;
  fallbackProviderName: string;
}

export interface LocalStorageChangeDetail {
  key: string;
  /** Serialized payload, or `null` when the key was removed (reset to initial). */
  newValue: string | null;
}

export interface LibraryRefreshDetail {
  providerId: ProviderId;
}

/**
 * Map of window CustomEvent type → `detail` payload.
 * Use `undefined` when the event carries no detail.
 */
export interface AppEventMap {
  [SESSION_EXPIRED_EVENT]: ProviderScopedDetail;
  [PROVIDER_RECONNECTED_EVENT]: ProviderScopedDetail;
  [PROVIDER_SESSION_FALLTHROUGH_EVENT]: ProviderSessionFallthroughDetail;
  [PROVIDER_DISCONNECTED_EVENT]: ProviderDisconnectedDetail;
  [LOCAL_STORAGE_CHANGE_EVENT]: LocalStorageChangeDetail;
  [AUTH_STATE_CHANGED_EVENT]: undefined;
  [DROPBOX_AUTH_ERROR_EVENT]: undefined;
  [DROPBOX_LIKES_CHANGED_EVENT]: undefined;
  [ART_REFRESHED_EVENT]: undefined;
  [LIBRARY_REFRESH_EVENT]: LibraryRefreshDetail;
  [UNIFIED_LIKED_CACHE_UPDATED_EVENT]: undefined;
  [PINS_CHANGED_EVENT]: undefined;
  [MOCK_SET_QUEUE_EVENT]: MediaTrack[];
  [MOCK_RESET_EVENT]: undefined;
  [MOCK_DROPBOX_LIKES_CHANGED_EVENT]: undefined;
}

type DetailArgs<D> = [D] extends [undefined] ? [] : [detail: D];

/**
 * Dispatch a typed app CustomEvent on `window`.
 * No-detail events omit the second argument.
 */
export function dispatchAppEvent<K extends keyof AppEventMap>(
  type: K,
  ...args: DetailArgs<AppEventMap[K]>
): void {
  if (typeof window === 'undefined') return;
  const detail = args[0] as AppEventMap[K];
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Subscribe to a typed app CustomEvent on `window`.
 * Returns an unsubscribe function.
 *
 * This is the only sanctioned place that reads `CustomEvent.detail` for
 * registry events — the cast stays here.
 */
export function onAppEvent<K extends keyof AppEventMap>(
  type: K,
  listener: (detail: AppEventMap[K]) => void,
): () => void {
  const handler = (event: Event): void => {
    listener((event as CustomEvent<AppEventMap[K]>).detail);
  };
  window.addEventListener(type, handler);
  return () => window.removeEventListener(type, handler);
}
