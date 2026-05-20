// Why CustomEvent indirection?
//
// `setQueue` needs to mutate React state (TrackContext). Directly importing
// TrackContext here would couple this test-only module to production
// state-management code and create a circular-dependency risk. Instead,
// `setQueue` dispatches a `CustomEvent('mock:set-queue')` that TrackContext
// listens for — keeping test-control's import surface limited to the mock
// adapter types it already owns. The listener is registered only when
// `shouldUseMockProvider()` is true, so it is a no-op in production.
import type { MockCatalogAdapter } from './mockCatalogAdapter';
import type { MockPlaybackAdapter } from './mockPlaybackAdapter';
import type { MockAuthAdapter } from './mockAuthAdapter';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { AUTH_STATE_CHANGED_EVENT } from '@/hooks/usePopupAuth';
import { SESSION_EXPIRED_EVENT } from '@/constants/events';

export interface ExpireAuthOptions {
  /**
   * When true, ALSO dispatch SESSION_EXPIRED_EVENT alongside the
   * AUTH_STATE_CHANGED_EVENT. Defaults to false — the narrower simulation
   * mirrors the legacy behavior and keeps existing Playwright specs stable.
   *
   * Real expiry in production dispatches both events (the refresh-token
   * rejection path fires SESSION_EXPIRED; the resulting state flip fires
   * AUTH_STATE_CHANGED). Opt in to this flag when an end-to-end test needs
   * the SESSION_EXPIRED handler in the SpotifyPlaybackAdapter (and other
   * listeners) to run ahead of the reconnect.
   */
  alsoDispatchSessionExpired?: boolean;
}

export interface MockTestApi {
  setQueue(trackIds: string[]): Promise<void>;
  setPlaybackState(state: { trackId: string; positionMs?: number; isPlaying?: boolean }): Promise<void>;
  expireAuth(providerId: ProviderId, opts?: ExpireAuthOptions): Promise<void>;
  restoreAuth(providerId: ProviderId): Promise<void>;
  /**
   * Emit a synthetic natural-end signal on the given provider's playback
   * adapter. Backdates the last-play timestamp past the cooldown guard so
   * the signal is not suppressed by useAutoAdvance's false-trigger filter.
   * Use this in Playwright specs to exercise the natural-end auto-advance
   * path without waiting for real audio playback to finish.
   */
  simulateNaturalEnd(providerId: ProviderId): Promise<void>;
  reset(): Promise<void>;
}

export interface InstallOptions {
  spotifyCatalog: MockCatalogAdapter;
  dropboxCatalog: MockCatalogAdapter;
  spotifyPlayback: MockPlaybackAdapter;
  dropboxPlayback: MockPlaybackAdapter;
  spotifyAuth: MockAuthAdapter;
  dropboxAuth: MockAuthAdapter;
}

export function installMockTestApi(opts: InstallOptions): void {
  if (typeof window === 'undefined') return;
  if (window.__mockTest) return;

  const {
    spotifyCatalog,
    dropboxCatalog,
    spotifyPlayback,
    dropboxPlayback,
    spotifyAuth,
    dropboxAuth,
  } = opts;

  function resolveAuth(providerId: ProviderId): MockAuthAdapter {
    if (providerId === 'spotify') return spotifyAuth;
    if (providerId === 'dropbox') return dropboxAuth;
    throw new Error(`[MockTestApi] Unknown providerId "${providerId}"`);
  }

  function resolveTrack(id: string): MediaTrack {
    const track =
      spotifyCatalog.getTrackById(id) ??
      dropboxCatalog.getTrackById(id);
    if (!track) {
      throw new Error(`[MockTestApi] Track id "${id}" not found in snapshots.`);
    }
    return track;
  }

  window.__mockTest = {
    async setQueue(trackIds) {
      const tracks = trackIds.map(resolveTrack);
      window.dispatchEvent(new CustomEvent('mock:set-queue', { detail: tracks }));
    },

    async setPlaybackState({ trackId, positionMs = 0, isPlaying = true }) {
      const track = resolveTrack(trackId);
      const adapter = track.provider === 'dropbox' ? dropboxPlayback : spotifyPlayback;
      await adapter.playTrack(track, { positionMs });
      if (!isPlaying) {
        await adapter.pause();
      }
    },

    async simulateNaturalEnd(providerId) {
      const adapter = providerId === 'dropbox' ? dropboxPlayback : spotifyPlayback;
      adapter.simulateNaturalEnd();
    },

    async expireAuth(providerId, opts) {
      resolveAuth(providerId).__testExpire();
      window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
      if (opts?.alsoDispatchSessionExpired) {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId } }),
        );
      }
    },

    async restoreAuth(providerId) {
      resolveAuth(providerId).__testRestoreAuth();
      window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
    },

    async reset() {
      window.dispatchEvent(new CustomEvent('mock:reset'));
      await Promise.all([
        spotifyPlayback.pause().catch(() => undefined),
        dropboxPlayback.pause().catch(() => undefined),
      ]);
    },
  };
}

declare global {
  interface Window {
    __mockTest?: MockTestApi;
  }
}
