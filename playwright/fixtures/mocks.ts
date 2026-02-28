import type { Page } from '@playwright/test';

export const mockPlaylists = {
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

export const mockAlbums = {
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

export const mockLikedSongsCount = {
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
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });
}

export async function setupSpotifySdkMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    const mockPlayer = {
      connect: () => Promise.resolve(true),
      disconnect: () => {},
      addListener: (event: string, callback: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        if (event === 'ready') {
          setTimeout(() => callback({ device_id: 'fake-device-id' }), 100);
        }
        return true;
      },
      removeListener: (event: string) => {
        delete listeners[event];
        return true;
      },
      getCurrentState: () => Promise.resolve(null),
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).onSpotifyWebPlaybackSDKReady === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).onSpotifyWebPlaybackSDKReady();
    }
  });
}

export async function setupAllMocks(page: Page): Promise<void> {
  await setupSpotifyApiMocks(page);
  await setupPlaybackApiMocks(page);
  await setupSpotifySdkMock(page);
}
