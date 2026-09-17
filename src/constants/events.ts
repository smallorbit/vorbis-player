export const AUTH_COMPLETE_EVENT = 'vorbis-auth-complete';

/**
 * Dispatched on `window` when a provider's refresh token is rejected as
 * permanently invalid (HTTP 400/401). Listeners should transition the
 * provider to a disconnected state and surface a reconnect prompt.
 *
 * Event `detail` is `{ providerId: ProviderId }`.
 */
export const SESSION_EXPIRED_EVENT = 'vorbis-session-expired';

/**
 * Dispatched on `window` when a provider transitions from `not authenticated`
 * to `authenticated` (e.g., the user re-toggles a previously-expired provider
 * on in Settings and OAuth completes). The playback layer listens to
 * re-prime the queue's current track at the user's last known position when
 * the current track belongs to the reconnected provider.
 *
 * Not dispatched on the initial render for providers that are already
 * authenticated at mount — the persisted-session hydrate path owns the
 * initial primed state. See `openspec/changes/reload-track-after-provider-reauth/`.
 *
 * Event `detail` is `{ providerId: ProviderId }`.
 */
export const PROVIDER_RECONNECTED_EVENT = 'vorbis-provider-reconnected';

/**
 * Dispatched on `window` after a same-tab localStorage write or remove that
 * went through `src/utils/persistedStorage.ts`. Native `storage` events do
 * not fire in the tab that wrote, so multi-mounted `useLocalStorage`
 * instances and non-hook writers (preferences sync, settings clear) use
 * this instead.
 *
 * Listeners re-apply `detail.newValue`. `newValue === null` means the key
 * was removed and hook state should reset to its initial value.
 *
 * Event `detail` is `{ key: string, newValue: string | null }`.
 */
export const LOCAL_STORAGE_CHANGE_EVENT = 'vorbis-local-storage-change';
