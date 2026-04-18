export const AUTH_COMPLETE_EVENT = 'vorbis-auth-complete';

/**
 * Dispatched on `window` when a provider's refresh token is rejected as
 * permanently invalid (HTTP 400/401). Listeners should transition the
 * provider to a disconnected state and surface a reconnect prompt.
 *
 * Event `detail` is `{ providerId: ProviderId }`.
 */
export const SESSION_EXPIRED_EVENT = 'vorbis-session-expired';
