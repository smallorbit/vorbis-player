import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import type { ProviderSnapshot, SnapshotTrack } from '../../../playwright/fixtures/data/snapshot.types';

function snapshotTrackToMediaTrack(track: SnapshotTrack, providerId: ProviderId): MediaTrack {
  return {
    id: track.id,
    provider: providerId,
    playbackRef: { provider: providerId, ref: track.ref },
    name: track.name,
    artists: track.artistsDisplay,
    artistsData: track.artists.map(a => ({ name: a.name, url: a.externalUrl })),
    album: track.album.name,
    albumId: track.album.id,
    trackNumber: track.trackNumber,
    durationMs: track.durationMs,
    image: track.image?.url,
    externalUrl: track.externalUrl,
    musicbrainzRecordingId: track.musicbrainzRecordingId,
    musicbrainzArtistId: track.musicbrainzArtistId,
    isrc: track.isrc,
    addedAt: track.addedAt,
    genres: track.genres ?? [],
  };
}

export class MockCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId;
  private snapshot: ProviderSnapshot;
  private likedSet: Set<string>;
  private savedAlbums: Set<string>;

  constructor(snapshot: ProviderSnapshot) {
    this.providerId = snapshot.meta.provider;
    this.snapshot = snapshot;
    this.likedSet = new Set(snapshot.likedTrackIds);
    this.savedAlbums = new Set(snapshot.albums.map(a => a.id));
  }

  async listCollections(): Promise<MediaCollection[]> {
    const collections: MediaCollection[] = [];

    if (this.providerId === 'dropbox') {
      const totalTracks = Object.keys(this.snapshot.tracks).length;
      collections.push({
        id: '',
        provider: 'dropbox',
        kind: 'folder',
        name: 'All Music',
        trackCount: totalTracks,
        genres: [],
      });
    }

    if (this.snapshot.likedTrackIds.length > 0) {
      collections.push({
        id: 'liked',
        provider: this.providerId,
        kind: 'liked',
        name: 'Liked Songs',
        trackCount: this.likedSet.size,
      });
    }

    for (const playlist of this.snapshot.playlists) {
      collections.push({
        id: playlist.id,
        provider: this.providerId,
        kind: 'playlist',
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.image?.url,
        trackCount: playlist.trackCount,
        ownerName: playlist.ownerName,
        revision: playlist.revision,
      });
    }

    for (const album of this.snapshot.albums) {
      collections.push({
        id: album.id,
        provider: this.providerId,
        kind: 'album',
        name: album.name,
        imageUrl: album.image?.url,
        trackCount: album.trackCount,
        ownerName: album.artists[0]?.name ?? null,
        releaseDate: album.releaseDate,
        genres: album.genres ?? [],
      });
    }

    return collections;
  }

  async listTracks(collectionRef: CollectionRef): Promise<MediaTrack[]> {
    if (collectionRef.provider !== this.providerId) return [];

    if (collectionRef.kind === 'liked') {
      return this.resolveTrackIds([...this.likedSet]);
    }

    if (collectionRef.kind === 'folder' && collectionRef.id === '') {
      return this.resolveTrackIds(Object.keys(this.snapshot.tracks));
    }

    if (collectionRef.kind === 'playlist') {
      const playlist = this.snapshot.playlists.find(p => p.id === collectionRef.id);
      if (!playlist) return [];
      return this.resolveTrackIds(playlist.trackIds);
    }

    if (collectionRef.kind === 'album') {
      const album = this.snapshot.albums.find(a => a.id === collectionRef.id);
      if (!album) return [];
      return this.resolveTrackIds(album.trackIds);
    }

    return [];
  }

  getTrackById(id: string): MediaTrack | undefined {
    const track = this.snapshot.tracks[id];
    return track ? snapshotTrackToMediaTrack(track, this.providerId) : undefined;
  }

  private resolveTrackIds(ids: string[]): MediaTrack[] {
    const tracks: MediaTrack[] = [];
    for (const id of ids) {
      const track = this.snapshot.tracks[id];
      if (!track) {
        console.warn(`[MockCatalog] Track ref "${id}" not found in snapshot — skipping`);
        continue;
      }
      tracks.push(snapshotTrackToMediaTrack(track, this.providerId));
    }
    return tracks;
  }

  async getLikedCount(): Promise<number> {
    return this.likedSet.size;
  }

  async isTrackSaved(trackId: string): Promise<boolean> {
    return this.likedSet.has(trackId);
  }

  async setTrackSaved(trackId: string, saved: boolean): Promise<void> {
    if (saved) {
      this.likedSet.add(trackId);
    } else {
      this.likedSet.delete(trackId);
    }
    if (this.providerId === 'dropbox') {
      window.dispatchEvent(new Event('mock-dropbox-likes-changed'));
    }
  }

  async isAlbumSaved(albumId: string): Promise<boolean> {
    return this.savedAlbums.has(albumId);
  }

  async setAlbumSaved(albumId: string, saved: boolean): Promise<void> {
    if (saved) {
      this.savedAlbums.add(albumId);
    } else {
      this.savedAlbums.delete(albumId);
    }
  }

  async searchTrack(artist: string, title: string): Promise<MediaTrack | null> {
    const artistLc = artist.toLowerCase();
    const titleLc = title.toLowerCase();
    const track = Object.values(this.snapshot.tracks).find(t => {
      return (
        t.name.toLowerCase().includes(titleLc) &&
        t.artistsDisplay.toLowerCase().includes(artistLc)
      );
    });
    return track ? snapshotTrackToMediaTrack(track, this.providerId) : null;
  }

  async resolveDuration(track: MediaTrack): Promise<number | null> {
    const snapshotTrack = this.snapshot.tracks[track.id];
    return snapshotTrack?.durationMs ?? null;
  }

  async resolveArtwork(albumId: string): Promise<string | null> {
    const album = this.snapshot.albums.find(a => a.id === albumId);
    return album?.image?.url ?? null;
  }

  async exportLikes(): Promise<string> {
    return JSON.stringify([...this.likedSet]);
  }

  async importLikes(json: string): Promise<number> {
    const ids = JSON.parse(json) as string[];
    let imported = 0;
    for (const id of ids) {
      if (!this.likedSet.has(id)) {
        this.likedSet.add(id);
        imported++;
      }
    }
    return imported;
  }

  async refreshLikedMetadata(): Promise<{ updated: number; removed: number }> {
    return { updated: 0, removed: 0 };
  }
}
