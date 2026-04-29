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
import type { MediaTrack } from '@/types/domain';

export interface MockTestApi {
  setQueue(trackIds: string[]): Promise<void>;
  setPlaybackState(state: { trackId: string; positionMs?: number; isPlaying?: boolean }): Promise<void>;
  reset(): Promise<void>;
}

export interface InstallOptions {
  spotifyCatalog: MockCatalogAdapter;
  dropboxCatalog: MockCatalogAdapter;
  spotifyPlayback: MockPlaybackAdapter;
  dropboxPlayback: MockPlaybackAdapter;
}

export function installMockTestApi(opts: InstallOptions): void {
  if (typeof window === 'undefined') return;
  if (window.__mockTest) return;

  const { spotifyCatalog, dropboxCatalog, spotifyPlayback, dropboxPlayback } = opts;

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
