/**
 * Dropbox track metadata enrichment — ID3 tag parsing and album-art cache
 * hydration extracted from DropboxPlaybackAdapter (Architecture v2 / F103).
 *
 * PlaybackAdapter owns transport; this module owns tag/art enrichment I/O.
 */

import type { MediaTrack, PlaybackState, TrackMetadataOverlay } from '@/types/domain';
import { parseID3 } from '@/utils/id3Parser';
import { bytesToDataUrl } from '@/utils/bytesToDataUrl';
import { putTagMetadata } from './dropboxArtCache';
import { logCaughtError } from '@/utils/logCaughtError';

export const ID3_FETCH_LIMIT = 262144; // 256KB — enough for large embedded cover art
export const ENRICHMENT_DELAY_MS = 2000; // Wait for audio to buffer before competing for bandwidth

export interface MetadataEnrichmentResult {
  /** Fields to merge onto the live MediaTrack (includes MusicBrainz / ISRC). */
  trackPatch: Partial<MediaTrack>;
  /** Overlay emitted via PlaybackState.trackMetadata (name/artists/album/image). */
  metadataUpdate: TrackMetadataOverlay;
}

export interface AlbumArtCacheDeps {
  getAlbumArtForAlbum: (albumId: string) => Promise<string | null>;
  cacheAlbumArtForAlbum: (albumId: string, dataUrl: string) => Promise<void>;
  resolveAlbumArt: (albumId: string) => Promise<string | null>;
}

/**
 * Best-effort ID3 enrichment from a temporary stream URL.
 * Returns null when the track changed mid-flight or no useful tags were found.
 */
export async function enrichMetadataFromStream(
  track: MediaTrack,
  streamUrl: string,
  options: {
    isStillCurrent: () => boolean;
    hasImage: () => boolean;
    cacheAlbumArt?: (albumId: string, dataUrl: string) => Promise<void>;
    delayMs?: number;
    fetchLimit?: number;
  },
): Promise<MetadataEnrichmentResult | null> {
  const delayMs = options.delayMs ?? ENRICHMENT_DELAY_MS;
  const fetchLimit = options.fetchLimit ?? ID3_FETCH_LIMIT;

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  if (!options.isStillCurrent()) return null;

  let res: Response;
  try {
    res = await fetch(streamUrl, { headers: { Range: `bytes=0-${fetchLimit - 1}` } });
  } catch (err) {
    logCaughtError('dropboxMetadataEnrichment.enrichMetadataFromStream', err);
    return null;
  }

  if ((!res.ok && res.status !== 206) || !res.body) return null;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (totalBytes < fetchLimit) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.length;
    }
  } finally {
    void reader.cancel();
  }

  if (!options.isStillCurrent()) return null;

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // WebAudio API boundary: parseID3 expects ArrayBuffer; combined.buffer is ArrayBufferLike under DOM lib typings.
  const { title, artist, album, coverArt, musicbrainzRecordingId, musicbrainzArtistId, isrc } =
    parseID3(combined.buffer as ArrayBuffer);

  const metadataUpdate: TrackMetadataOverlay = {};
  if (title && title !== track.name) metadataUpdate.name = title;
  if (artist && artist !== track.artists) metadataUpdate.artists = artist;
  if (album && album !== track.album) metadataUpdate.album = album;
  if (coverArt && !options.hasImage()) {
    metadataUpdate.image = bytesToDataUrl(coverArt.data, coverArt.mimeType);
    if (track.albumId && options.cacheAlbumArt) {
      void options.cacheAlbumArt(track.albumId, metadataUpdate.image).catch(() => {});
    }
  }

  if (title || artist || album) {
    void putTagMetadata(track.id, {
      ...(title ? { name: title } : {}),
      ...(artist ? { artists: artist } : {}),
      ...(album ? { album } : {}),
    }).catch(() => {});
  }

  const trackPatch: Partial<MediaTrack> = { ...metadataUpdate };
  if (musicbrainzRecordingId) trackPatch.musicbrainzRecordingId = musicbrainzRecordingId;
  if (musicbrainzArtistId) trackPatch.musicbrainzArtistId = musicbrainzArtistId;
  if (isrc) trackPatch.isrc = isrc;

  if (Object.keys(metadataUpdate).length === 0 && Object.keys(trackPatch).length === 0) {
    return null;
  }

  return { trackPatch, metadataUpdate };
}

/**
 * Apply a successful enrichment result onto adapter-owned track / pending-metadata state.
 * Returns the updated currentTrack reference when a patch was applied.
 */
export function applyEnrichmentResult(
  currentTrack: MediaTrack,
  result: MetadataEnrichmentResult,
): {
  currentTrack: MediaTrack;
  pendingMetadataUpdate: PlaybackState['trackMetadata'] | null;
} {
  const hasMetadataKeys = Object.keys(result.metadataUpdate).length > 0;
  return {
    currentTrack: { ...currentTrack, ...result.trackPatch },
    pendingMetadataUpdate: hasMetadataKeys ? result.metadataUpdate : null,
  };
}

/**
 * Hydrate `track.image` from the album-art cache when the track has no image yet.
 */
export function hydrateAlbumArtFromCache(
  track: MediaTrack,
  deps: Pick<AlbumArtCacheDeps, 'getAlbumArtForAlbum'>,
  onResolved: (image: string) => void,
): void {
  if (track.image || !track.albumId) return;
  void deps
    .getAlbumArtForAlbum(track.albumId)
    .then((cachedImage) => {
      if (!cachedImage) return;
      onResolved(cachedImage);
    })
    .catch((err) => {
      logCaughtError('dropboxMetadataEnrichment.hydrateAlbumArtFromCache', err);
    });
}

/**
 * Resolve folder cover art for the current track when it still has no image.
 */
export function resolveFolderAlbumArt(
  track: MediaTrack,
  deps: Pick<AlbumArtCacheDeps, 'resolveAlbumArt'>,
  onResolved: (image: string) => void,
): void {
  if (track.image || !track.albumId) return;
  void deps
    .resolveAlbumArt(track.albumId)
    .then((imageUrl) => {
      if (!imageUrl) return;
      onResolved(imageUrl);
    })
    .catch((err) => {
      logCaughtError('dropboxMetadataEnrichment.resolveFolderAlbumArt', err);
    });
}
