
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SpotifyApiClient } from '../spotify-api.ts';
import { runListSpotify } from '../list-spotify.ts';

function makeClient(overrides: Partial<SpotifyApiClient> = {}): SpotifyApiClient {
  return {
    getMe: vi.fn(),
    getPlaylist: vi.fn(),
    getPlaylistTracks: vi.fn(),
    getAlbum: vi.fn(),
    getLikedTracks: vi.fn(),
    listMyPlaylists: vi.fn().mockResolvedValue([
      { id: 'pl2', name: 'Zen Music', tracks: { total: 20 }, followers: { total: 500 } },
      { id: 'pl1', name: 'Acoustic', tracks: { total: 10 }, followers: { total: 1234 } },
    ]),
    listMySavedAlbums: vi.fn().mockResolvedValue([
      { album: { id: 'alb1', name: 'The Wall', artists: [{ name: 'Pink Floyd' }], total_tracks: 26 } },
    ]),
    getRecentlyPlayed: vi.fn().mockResolvedValue([
      { track: { id: 'tr1', name: 'Comfortably Numb', artists: [{ name: 'Pink Floyd' }] } },
      { track: { id: 'tr2', name: 'Time', artists: [{ name: 'Pink Floyd' }] } },
    ]),
    getLikedTracksCount: vi.fn().mockResolvedValue(314),
    ...overrides,
  };
}

describe('runListSpotify', () => {
  let stdout: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    stdout = [];
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('prints PLAYLISTS section sorted alphabetically by name', async () => {
    await runListSpotify(makeClient());
    const playlistsSection = stdout.findIndex((l) => l === 'PLAYLISTS');
    expect(playlistsSection).toBeGreaterThanOrEqual(0);

    const lines = stdout.slice(playlistsSection + 1);
    const playlistLines = lines.filter((l) => l.startsWith('-'));
    // Sorted: Acoustic before Zen Music
    expect(playlistLines[0]).toContain('Acoustic');
    expect(playlistLines[1]).toContain('Zen Music');
  });

  it('uses a single tab between id and the rest of the line', async () => {
    await runListSpotify(makeClient());
    const pl1Line = stdout.find((l) => l.includes('Acoustic'));
    // Single tab between id and name+count — no second tab before the count
    expect(pl1Line).toMatch(/- pl1\t/);
    expect(pl1Line).not.toMatch(/pl1\t.*\t/);
  });

  it('includes track count and followers in playlist lines', async () => {
    await runListSpotify(makeClient());
    const line = stdout.find((l) => l.includes('Acoustic'));
    expect(line).toContain('10 tracks');
    expect(line).toContain('1234 followers');
  });

  it('prints ALBUMS (saved) section', async () => {
    await runListSpotify(makeClient());
    const hasAlbumsSection = stdout.some((l) => l === '\nALBUMS (saved)' || l === 'ALBUMS (saved)');
    expect(hasAlbumsSection).toBe(true);
    const albumLine = stdout.find((l) => l.includes('The Wall'));
    expect(albumLine).toContain('Pink Floyd');
    expect(albumLine).toContain('26 tracks');
  });

  it('prints RECENTLY PLAYED section in original order (not sorted)', async () => {
    await runListSpotify(makeClient());
    const recentLines = stdout.filter((l) => l.includes('track:'));
    expect(recentLines[0]).toContain('Comfortably Numb');
    expect(recentLines[1]).toContain('Time');
  });

  it('uses track: prefix on recently played IDs', async () => {
    await runListSpotify(makeClient());
    const recentLine = stdout.find((l) => l.includes('Comfortably Numb'));
    expect(recentLine).toContain('track:tr1');
  });

  it('prints LIKED-TRACKS COUNT', async () => {
    await runListSpotify(makeClient());
    const countLine = stdout.find((l) => l.includes('LIKED-TRACKS COUNT'));
    expect(countLine).toContain('314');
  });

  it('playlist IDs are bare (no spotify:playlist: prefix)', async () => {
    await runListSpotify(makeClient());
    const pl1Line = stdout.find((l) => l.includes('Acoustic'));
    expect(pl1Line).toContain('pl1');
    expect(pl1Line).not.toContain('spotify:playlist:');
  });
});
