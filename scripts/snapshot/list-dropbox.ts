import type { DropboxApiClient } from './dropbox-api.ts';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const PLAYLIST_PROBE_PATH = '/.vorbis-player/playlists';

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function parentDir(pathLower: string): string {
  const idx = pathLower.lastIndexOf('/');
  return idx <= 0 ? '/' : pathLower.slice(0, idx);
}

/**
 * Enumerates the user's Dropbox and prints a structured summary to stdout.
 * Read-only: no JSON is written, no art is downloaded.
 *
 * Stdout format:
 *   FOLDERS (album-shaped — folders containing audio files at the leaf)
 *   - /path/to/folder  (<N> tracks, <M> art images)
 *   SAVED-PLAYLIST FILES (vorbis-player JSON shape)
 *   - /.vorbis-player/playlists/road-trip.json
 */
export async function runListDropbox(
  client: DropboxApiClient,
  opts?: { root?: string },
): Promise<void> {
  const rootPath = opts?.root ?? '';
  const allEntries = await client.listFolderRecursive(rootPath);

  // Group by folder: count audio tracks and art images per directory
  const audioByDir = new Map<string, number>();
  const artByDir = new Map<string, number>();
  const playlistFiles: string[] = [];

  for (const entry of allEntries) {
    if (entry['.tag'] !== 'file') continue;
    const dir = parentDir(entry.path_lower);

    if (isAudioFile(entry.name)) {
      audioByDir.set(dir, (audioByDir.get(dir) ?? 0) + 1);
    } else if (isImageFile(entry.name)) {
      artByDir.set(dir, (artByDir.get(dir) ?? 0) + 1);
    } else if (
      entry.name.endsWith('.json') &&
      entry.path_lower.startsWith(PLAYLIST_PROBE_PATH)
    ) {
      playlistFiles.push(entry.path_lower);
    }
  }

  // Album-shaped folders: directories that contain at least one audio file
  const albumFolders = [...audioByDir.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, trackCount]) => ({ dir, trackCount, artCount: artByDir.get(dir) ?? 0 }));

  console.log('FOLDERS (album-shaped — folders containing audio files at the leaf)');
  if (albumFolders.length === 0) {
    console.log('  (none)');
  } else {
    for (const { dir, trackCount, artCount } of albumFolders) {
      console.log(`- ${dir}\t(${trackCount} tracks, ${artCount} art image${artCount === 1 ? '' : 's'})`);
    }
  }

  const sortedPlaylists = [...playlistFiles].sort();
  console.log('\nSAVED-PLAYLIST FILES (vorbis-player JSON shape)');
  if (sortedPlaylists.length === 0) {
    console.log('  (none)');
  } else {
    for (const filePath of sortedPlaylists) {
      console.log(`- ${filePath}`);
    }
  }
}
