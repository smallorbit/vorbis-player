/**
 * Apple Music CatalogProvider adapter.
 * Maps Apple Music library API responses to domain types.
 */

import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import { appleMusicService } from './appleMusicService';
import type { MKArtworkDescriptor, MKMediaItem, MKLibraryCollection, MKPaginatedResponse, MKInstance } from './appleMusicTypes';

const PAGE_LIMIT = 100;

function formatArtworkUrl(artwork: MKArtworkDescriptor | undefined, size: number): string | undefined {
  if (!artwork?.url) return undefined;
  // MusicKit artwork URLs use {w}x{h} placeholders
  return artwork.url.replace('{w}', String(size)).replace('{h}', String(size));
}

function appleTrackToMediaTrack(item: MKMediaItem): MediaTrack {
  const attrs = item.attributes;
  const catalogId = attrs.playParams?.catalogId ?? item.id;
  return {
    id: item.id,
    provider: 'apple-music',
    playbackRef: { provider: 'apple-music', ref: catalogId },
    name: attrs.name,
    artists: attrs.artistName,
    album: attrs.albumName,
    albumId: attrs.playParams?.catalogId,
    trackNumber: attrs.trackNumber,
    durationMs: attrs.durationInMillis,
    image: formatArtworkUrl(attrs.artwork, 300),
    externalUrl: attrs.url ?? `https://music.apple.com/song/${catalogId}`,
  };
}

function appleCollectionToMediaCollection(
  item: MKLibraryCollection,
  kind: 'playlist' | 'album',
): MediaCollection {
  const attrs = item.attributes;
  return {
    id: item.id,
    provider: 'apple-music',
    kind,
    name: attrs.name,
    description: attrs.description?.standard ?? null,
    imageUrl: formatArtworkUrl(attrs.artwork, 300),
    trackCount: attrs.trackCount,
    ownerName: attrs.artistName ?? null,
  };
}

export class AppleMusicCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'apple-music';

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    const instance = await appleMusicService.ensureLoaded();
    const collections: MediaCollection[] = [];

    // Fetch library playlists
    const playlists = await this.fetchAllPages<MKLibraryCollection>(
      instance,
      '/v1/me/library/playlists',
      signal,
    );
    for (const p of playlists) {
      collections.push(appleCollectionToMediaCollection(p, 'playlist'));
    }

    // Fetch library albums
    const albums = await this.fetchAllPages<MKLibraryCollection>(
      instance,
      '/v1/me/library/albums',
      signal,
    );
    for (const a of albums) {
      collections.push(appleCollectionToMediaCollection(a, 'album'));
    }

    return collections;
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'apple-music') return [];
    if (collectionRef.kind === 'liked') return this.fetchLikedTracks(signal);

    const instance = await appleMusicService.ensureLoaded();
    const kindPath = collectionRef.kind === 'playlist' ? 'playlists' : 'albums';
    const path = `/v1/me/library/${kindPath}/${collectionRef.id}/tracks`;

    const items = await this.fetchAllPages<MKMediaItem>(instance, path, signal);
    return items.map(appleTrackToMediaTrack);
  }

  async getLikedCount(signal?: AbortSignal): Promise<number> {
    const instance = await appleMusicService.ensureLoaded();
    try {
      const response = await instance.api.music('/v1/me/ratings/library-songs', { limit: 1 });
      const data = response.data as MKPaginatedResponse<unknown>;
      return data.meta?.total ?? data.data.length;
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      console.error('[AppleMusicCatalog] Failed to get liked count:', err);
      return 0;
    }
  }

  async isTrackSaved(trackId: string): Promise<boolean> {
    const instance = await appleMusicService.ensureLoaded();
    try {
      const response = await instance.api.music(`/v1/me/ratings/library-songs/${trackId}`);
      const data = response.data as MKPaginatedResponse<unknown>;
      return data.data.length > 0;
    } catch {
      // 404 means not rated
      return false;
    }
  }

  async setTrackSaved(trackId: string, saved: boolean): Promise<void> {
    const instance = await appleMusicService.ensureLoaded();
    const token = instance.musicUserToken;
    const devToken = instance.developerToken;

    const url = `https://api.music.apple.com/v1/me/ratings/library-songs/${trackId}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${devToken}`,
      'Music-User-Token': token,
      'Content-Type': 'application/json',
    };

    if (saved) {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          type: 'rating',
          attributes: { value: 1 },
        }),
      });
      if (!response.ok) {
        throw new Error(`Apple Music rate error: ${response.status}`);
      }
    } else {
      const response = await fetch(url, { method: 'DELETE', headers });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Apple Music unrate error: ${response.status}`);
      }
    }
  }

  private async fetchLikedTracks(signal?: AbortSignal): Promise<MediaTrack[]> {
    const instance = await appleMusicService.ensureLoaded();
    // Fetch rated songs then resolve to full track data
    const ratings = await this.fetchAllPages<MKMediaItem>(
      instance,
      '/v1/me/ratings/library-songs',
      signal,
    );

    // Batch-fetch song details for each rated song
    const trackIds = ratings.map((r) => r.id);
    if (trackIds.length === 0) return [];

    const tracks: MediaTrack[] = [];
    // Fetch in batches of 100
    for (let i = 0; i < trackIds.length; i += PAGE_LIMIT) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = trackIds.slice(i, i + PAGE_LIMIT);
      try {
        const response = await instance.api.music(
          `/v1/me/library/songs`,
          { 'filter[id]': batch.join(','), limit: PAGE_LIMIT },
        );
        const data = response.data as MKPaginatedResponse<MKMediaItem>;
        for (const item of data.data) {
          tracks.push(appleTrackToMediaTrack(item));
        }
      } catch (err) {
        console.error('[AppleMusicCatalog] Failed to fetch liked track batch:', err);
      }
    }

    return tracks;
  }

  private async fetchAllPages<T>(
    instance: MKInstance,
    path: string,
    signal?: AbortSignal,
  ): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;

    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const separator = path.includes('?') ? '&' : '?';
      const url = `${path}${separator}limit=${PAGE_LIMIT}&offset=${offset}`;

      const response = await instance.api.music(url);
      const data = response.data as MKPaginatedResponse<T>;
      all.push(...data.data);

      if (data.data.length < PAGE_LIMIT || !data.next) break;
      offset += PAGE_LIMIT;
    }

    return all;
  }
}
