import type { Page } from '@playwright/test';

const mockPlaylists = {
  items: [
    {
      id: 'playlist-1',
      name: 'Chill Vibes',
      description: 'Relaxing tunes',
      images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
      tracks: { total: 10 },
      owner: { display_name: 'TestUser' },
      snapshot_id: 'snap-1',
    },
    {
      id: 'playlist-2',
      name: 'Workout Mix',
      description: 'High energy',
      images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
      tracks: { total: 5 },
      owner: { display_name: 'TestUser' },
      snapshot_id: 'snap-2',
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
  next: null,
};

const mockAlbums = {
  items: [
    {
      added_at: '2024-01-01T00:00:00Z',
      album: {
        id: 'album-1',
        name: 'Test Album',
        artists: [{ name: 'Test Artist', external_urls: { spotify: '' } }],
        images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
        release_date: '2024-01-01',
        total_tracks: 12,
        uri: 'spotify:album:album-1',
        album_type: 'album',
      },
    },
    {
      added_at: '2023-06-15T00:00:00Z',
      album: {
        id: 'album-2',
        name: 'Another Album',
        artists: [{ name: 'Another Artist', external_urls: { spotify: '' } }],
        images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
        release_date: '2023-06-15',
        total_tracks: 8,
        uri: 'spotify:album:album-2',
        album_type: 'album',
      },
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
  next: null,
};

const mockLikedSongsCount = {
  items: [],
  total: 25,
  limit: 1,
  offset: 0,
  next: null,
};

export const mockTracks = {
  items: [
    {
      track: {
        id: 'track-1',
        name: 'Test Song',
        artists: [{ name: 'Test Artist', external_urls: { spotify: '' } }],
        album: {
          name: 'Test Album',
          id: 'album-1',
          images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
        },
        duration_ms: 210000,
        uri: 'spotify:track:track-1',
        preview_url: null,
        track_number: 1,
      },
    },
    {
      track: {
        id: 'track-2',
        name: 'Another Song',
        artists: [{ name: 'Test Artist', external_urls: { spotify: '' } }],
        album: {
          name: 'Test Album',
          id: 'album-1',
          images: [{ url: 'https://via.placeholder.com/300', width: 300, height: 300 }],
        },
        duration_ms: 180000,
        uri: 'spotify:track:track-2',
        preview_url: null,
        track_number: 2,
      },
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
  next: null,
};

export async function setupSpotifyApiMocks(page: Page): Promise<void> {
  await page.route('**/v1/me/playlists**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPlaylists) })
  );

  await page.route('**/v1/me/albums**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAlbums) })
  );

  await page.route('**/v1/me/tracks?limit=1**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLikedSongsCount) })
  );

  await page.route('**/v1/me/tracks?limit=50**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockTracks) })
  );

  await page.route('**/v1/me/tracks/contains**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([false]) })
  );
}

export async function setupPlaybackApiMocks(page: Page): Promise<void> {
  await page.route('**/v1/me/player/play**', (route) =>
    route.fulfill({ status: 204 })
  );

  await page.route('**/v1/me/player/pause**', (route) =>
    route.fulfill({ status: 204 })
  );

  await page.route('**/v1/me/player/next**', (route) =>
    route.fulfill({ status: 204 })
  );

  await page.route('**/v1/me/player/previous**', (route) =>
    route.fulfill({ status: 204 })
  );

  await page.route('**/v1/me/player', (route) => {
    const method = route.request().method();
    if (method === 'PUT') return route.fulfill({ status: 204 });
    if (method === 'GET')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_playing: false, device: { id: 'fake-device-id', is_active: true } }),
      });
    return route.continue();
  });

}

export async function setupSpotifySdkMock(page: Page): Promise<void> {
  // Intercept the real Spotify SDK script so it never loads and overwrites window.Spotify.
  // The stub polls until onSpotifyWebPlaybackSDKReady is defined (React app may not have
  // set it yet when the script tag in index.html first executes), then calls it.
  await page.route('**/sdk.scdn.co/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `(function poll(){
        if(typeof window.onSpotifyWebPlaybackSDKReady==='function'){
          window.onSpotifyWebPlaybackSDKReady();
        } else {
          setTimeout(poll, 50);
        }
      })();`,
    })
  );

  await page.addInitScript(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    const mockTrackState = {
      track_window: {
        current_track: {
          id: 'track-1',
          name: 'Test Song',
          uri: 'spotify:track:track-1',
          duration_ms: 210000,
          artists: [{ name: 'Test Artist', uri: 'spotify:artist:test' }],
          album: {
            name: 'Test Album',
            images: [{ url: 'https://via.placeholder.com/300' }],
          },
        },
        next_tracks: [],
        previous_tracks: [],
      },
      paused: false,
      position: 0,
      duration: 210000,
      shuffle: false,
      repeat_mode: 0,
    };

    const mockPlayer = {
      connect: () => Promise.resolve(true),
      disconnect: () => {},
      addListener: (event: string, callback: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        if (event === 'ready') {
          setTimeout(() => {
            callback({ device_id: 'fake-device-id' });
            // After ready, emit an initial player_state_changed so the app
            // knows what track is playing without waiting for real SDK events.
            setTimeout(() => {
              (listeners['player_state_changed'] ?? []).forEach((cb) =>
                cb(mockTrackState)
              );
            }, 150);
          }, 100);
        }
        return true;
      },
      removeListener: (event: string) => {
        delete listeners[event];
        return true;
      },
      getCurrentState: () => Promise.resolve(mockTrackState),
      setName: () => Promise.resolve(),
      getVolume: () => Promise.resolve(0.5),
      setVolume: () => Promise.resolve(),
      pause: () => Promise.resolve(),
      resume: () => Promise.resolve(),
      togglePlay: () => Promise.resolve(),
      seek: () => Promise.resolve(),
      previousTrack: () => Promise.resolve(),
      nextTrack: () => Promise.resolve(),
      activateElement: () => Promise.resolve(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Spotify = {
      Player: function () {
        return mockPlayer;
      },
    };
  });
}

export async function setupAllMocks(page: Page): Promise<void> {
  await setupSpotifyApiMocks(page);
  await setupPlaybackApiMocks(page);
  await setupSpotifySdkMock(page);
}
