export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ALBUM_ART_NAMES = ['cover', 'album', 'folder', 'front', 'album cover', 'album_cover', 'artwork'];

export interface DropboxFileEntry {
  '.tag': 'file' | 'folder';
  name: string;
  id: string;
  path_lower: string;
  path_display: string;
  size?: number;
}

export interface DropboxListFolderResult {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
}

export interface CachedLink {
  url: string;
  expiresAt: number;
}

/** Dropbox temporary links are valid for 4 hours; cache for 3.5 h to be safe. */
export const TEMP_LINK_TTL_MS = 3.5 * 60 * 60 * 1000;

export function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
}

function findArtByNames(entries: DropboxFileEntry[], names: string[]): string | null {
  for (const preferred of names) {
    const found = entries.find((e) => baseName(e.name) === preferred || baseName(e.name).includes(preferred));
    if (found) return found.path_lower;
  }
  return null;
}

export function pickAlbumArtPath(entries: DropboxFileEntry[]): string | null {
  if (entries.length === 0) return null;
  return findArtByNames(entries, ALBUM_ART_NAMES) ?? entries[0].path_lower;
}

export function parentDir(path: string): string {
  return path.split('/').slice(0, -1).join('/') || '/';
}

export function parseFilename(filename: string): { name: string; trackNumber?: number } {
  const base = filename.replace(/\.[^/.]+$/, '');
  const match = base.match(/^(\d{1,3})\s*[-.\s]\s*(.+)$/);
  if (match) {
    return { name: match[2].trim(), trackNumber: parseInt(match[1], 10) };
  }
  return { name: base };
}

import type { MediaTrack } from '@/types/domain';
import {
  getDurationsMap,
  getAlbumArt,
} from './dropboxArtCache';

export function entryToMediaTrack(entry: DropboxFileEntry, imageUrl?: string): MediaTrack {
  const { name, trackNumber } = parseFilename(entry.name);

  const displayParts = entry.path_display.split('/').filter(Boolean);
  const albumName = displayParts.length >= 2 ? displayParts[displayParts.length - 2] : 'Unknown Album';
  const artistName = displayParts.length >= 3 ? displayParts[displayParts.length - 3] : undefined;

  const albumId = parentDir(entry.path_lower);

  const artist = artistName ?? 'Unknown Artist';
  return {
    id: entry.id,
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: entry.path_lower },
    name,
    artists: artist,
    artistsData: [{ name: artist }],
    album: albumName,
    albumId,
    trackNumber,
    durationMs: 0,
    image: imageUrl,
  };
}

export async function hydrateCachedDurations(tracks: MediaTrack[]): Promise<void> {
  const needDuration = tracks.filter((t) => !t.durationMs);
  if (needDuration.length === 0) return;
  const durationsMap = await getDurationsMap(needDuration.map((t) => t.id));
  if (durationsMap.size > 0) {
    for (const t of needDuration) {
      const cached = durationsMap.get(t.id);
      if (cached !== undefined) t.durationMs = cached;
    }
  }
}

export async function hydrateCachedArtwork(tracks: MediaTrack[]): Promise<void> {
  const needArt = tracks.filter((t) => !t.image && t.albumId);
  if (needArt.length === 0) return;
  const albumIds = [...new Set(needArt.map((t) => t.albumId!))];
  const artMap = new Map<string, string>();
  await Promise.all(
    albumIds.map(async (albumId) => {
      const cached = await getAlbumArt(albumId);
      if (cached) artMap.set(albumId, cached);
    }),
  );
  if (artMap.size > 0) {
    for (const t of needArt) {
      const art = artMap.get(t.albumId!);
      if (art) t.image = art;
    }
  }
}

export function probeAudioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10_000);

    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onError);
      audio.src = '';
      audio.load();
    };

    const onMeta = () => {
      const dur = audio.duration;
      cleanup();
      if (!isNaN(dur) && dur > 0) {
        resolve(Math.floor(dur * 1000));
      } else {
        resolve(null);
      }
    };

    const onError = () => {
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onMeta, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = url;
  });
}
