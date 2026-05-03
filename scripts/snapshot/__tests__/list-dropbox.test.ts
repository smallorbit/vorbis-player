
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DropboxApiClient, DropboxFolderEntry } from '../dropbox-api.ts';
import { runListDropbox } from '../list-dropbox.ts';

function makeEntry(tag: 'file' | 'folder', pathLower: string, name?: string): DropboxFolderEntry {
  return {
    '.tag': tag,
    path_lower: pathLower,
    name: name ?? pathLower.split('/').pop() ?? pathLower,
  };
}

function makeClient(entries: DropboxFolderEntry[]): DropboxApiClient {
  return {
    getCurrentAccount: vi.fn(),
    listFolderRecursive: vi.fn().mockResolvedValue(entries),
    downloadFile: vi.fn(),
  };
}

describe('runListDropbox', () => {
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

  const entries: DropboxFolderEntry[] = [
    makeEntry('folder', '/pink floyd'),
    makeEntry('folder', '/pink floyd/the wall'),
    makeEntry('file', '/pink floyd/the wall/01 - in the flesh.mp3'),
    makeEntry('file', '/pink floyd/the wall/02 - the thin ice.mp3'),
    makeEntry('file', '/pink floyd/the wall/cover.jpg'),
    makeEntry('folder', '/andy timmons band'),
    makeEntry('folder', '/andy timmons band/theme from a perfect world'),
    makeEntry('file', '/andy timmons band/theme from a perfect world/01 - theme.mp3'),
    makeEntry('file', '/.vorbis-player/playlists/road-trip.json'),
    makeEntry('file', '/.vorbis-player/playlists/chill.json'),
  ];

  it('prints FOLDERS section with album-shaped directories', async () => {
    await runListDropbox(makeClient(entries));
    const hasFolders = stdout.some((l) => l.includes('FOLDERS'));
    expect(hasFolders).toBe(true);
    const wallLine = stdout.find((l) => l.includes('/pink floyd/the wall'));
    expect(wallLine).toBeTruthy();
  });

  it('reports correct track count per folder', async () => {
    await runListDropbox(makeClient(entries));
    const wallLine = stdout.find((l) => l.includes('/pink floyd/the wall'));
    expect(wallLine).toContain('2 tracks');
  });

  it('counts art images correctly', async () => {
    await runListDropbox(makeClient(entries));
    const wallLine = stdout.find((l) => l.includes('/pink floyd/the wall'));
    expect(wallLine).toContain('1 art image');
  });

  it('sorts album folders alphabetically', async () => {
    await runListDropbox(makeClient(entries));
    const folderLines = stdout.filter((l) => l.startsWith('-') && l.includes('/'));
    const playlistSection = stdout.findIndex((l) => l.includes('SAVED-PLAYLIST'));
    const folderSection = stdout.findIndex((l) => l.includes('FOLDERS'));
    const folderOnlyLines = stdout
      .slice(folderSection + 1, playlistSection)
      .filter((l) => l.startsWith('-'));
    expect(folderOnlyLines[0]).toContain('/andy timmons band');
    expect(folderOnlyLines[1]).toContain('/pink floyd');
    void folderLines;
  });

  it('prints SAVED-PLAYLIST FILES section', async () => {
    await runListDropbox(makeClient(entries));
    const hasPlaylistSection = stdout.some((l) => l.includes('SAVED-PLAYLIST FILES'));
    expect(hasPlaylistSection).toBe(true);
    const road = stdout.find((l) => l.includes('road-trip.json'));
    expect(road).toBeTruthy();
    const chill = stdout.find((l) => l.includes('chill.json'));
    expect(chill).toBeTruthy();
  });

  it('prints (none) when no album-shaped folders are found', async () => {
    const emptyEntries: DropboxFolderEntry[] = [];
    await runListDropbox(makeClient(emptyEntries));
    const noneLine = stdout.find((l) => l.includes('(none)'));
    expect(noneLine).toBeTruthy();
  });

  it('prints (none) under saved playlist section when no playlist files exist', async () => {
    const noPlaylists = entries.filter((e) => !e.path_lower.includes('.vorbis-player'));
    await runListDropbox(makeClient(noPlaylists));
    const lines = stdout.join('\n');
    expect(lines).toContain('(none)');
  });

  it('does not include parent folders (non-leaf with no direct audio) as album-shaped', async () => {
    await runListDropbox(makeClient(entries));
    const parentLine = stdout.find((l) => l.startsWith('-') && l.includes('/pink floyd') && !l.includes('the wall'));
    expect(parentLine).toBeFalsy();
  });
});
