import { test } from '../fixtures';
import { animationSettle, captureScreenshot, waitForPlayerReady } from '../helpers';
import spotifySnapshot from '../../fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshot from '../../fixtures/data/dropbox-snapshot.json' with { type: 'json' };

test.describe('Cross-Provider Queue', () => {
  test('capture cross-provider queue drawer', async ({ capturePage }, testInfo) => {
    const spotifyTrackIds = spotifySnapshot.playlists?.[0]?.trackIds.slice(0, 4) ?? [];
    const dropboxTrackIds = dropboxSnapshot.albums?.[0]?.trackIds.slice(0, 1) ?? [];
    const moreSpotifyTrackIds = spotifySnapshot.playlists?.[0]?.trackIds.slice(4, 7) ?? [];

    if (spotifyTrackIds.length < 4 || dropboxTrackIds.length < 1) {
      console.log('[SKIP] cross-provider-queue: snapshots do not have enough tracks.');
      test.skip();
      return;
    }

    const queueIds = [...spotifyTrackIds, ...dropboxTrackIds, ...moreSpotifyTrackIds];

    await waitForPlayerReady(capturePage);

    await capturePage.evaluate(async (ids: string[]) => {
      await window.__mockTest!.setQueue(ids);
    }, queueIds);

    await capturePage.evaluate(async (state: { trackId: string; positionMs: number; isPlaying: boolean }) => {
      await window.__mockTest!.setPlaybackState(state);
    }, { trackId: queueIds[0], positionMs: 7500, isPlaying: true });

    await capturePage.keyboard.press('q');
    await animationSettle(capturePage, 800);

    await captureScreenshot(capturePage, 'cross-provider-queue', testInfo);
  });
});
