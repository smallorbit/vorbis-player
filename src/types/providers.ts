/**
 * Provider contracts: Auth, Catalog, and Playback.
 * All music sources (Spotify, Dropbox, future) implement these interfaces.
 */

import type { MediaTrack, MediaCollection, CollectionRef, PlaybackState, ProviderId } from './domain';
import type { ComponentType } from 'react';

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export interface AuthProvider {
  readonly providerId: ProviderId;
  isAuthenticated(): boolean;
  getAccessToken(): Promise<string | null>;
  /** Start OAuth (redirect or open popup). */
  beginLogin(options?: { popup?: boolean }): Promise<void>;
  /** Handle OAuth callback (e.g. parse URL and exchange code). */
  handleCallback(url: URL): Promise<boolean>;
  logout(): void;
}

// -----------------------------------------------------------------------------
// Catalog (library / collections / tracks)
// -----------------------------------------------------------------------------

export interface CatalogProvider {
  readonly providerId: ProviderId;
  /** List collections (playlists, albums, folders) for library browser. */
  listCollections(signal?: AbortSignal, options?: { forceRefresh?: boolean }): Promise<MediaCollection[]>;
  /** List tracks for a collection. */
  listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]>;
  /** Optional: total count for "Liked" or similar (Spotify). */
  getLikedCount?(signal?: AbortSignal): Promise<number>;
  /** Optional: save/unsave track (Spotify liked). */
  setTrackSaved?(trackId: string, saved: boolean): Promise<void>;
  isTrackSaved?(trackId: string): Promise<boolean>;
  /** Optional: save/unsave album to library. */
  setAlbumSaved?(albumId: string, saved: boolean): Promise<void>;
  isAlbumSaved?(albumId: string): Promise<boolean>;
  /** Optional: delete/unfollow a collection (playlist). */
  deleteCollection?(collectionId: string, kind: import('./domain').CollectionKind): Promise<void>;
  /** Optional: resolve missing duration for a track (e.g. probe audio metadata). */
  resolveDuration?(track: MediaTrack): Promise<number | null>;
  /** Optional: resolve missing artwork for an album. Returns image URL/data-URL or null. */
  resolveArtwork?(albumId: string, signal?: AbortSignal): Promise<string | null>;
  /** Optional: search for a track by artist + title (used for cross-provider resolution). */
  searchTrack?(artist: string, title: string): Promise<MediaTrack | null>;
  /** Optional: clear cached album art. */
  clearArtCache?(): Promise<void>;
  /** Optional: clear art + catalog caches and trigger a re-fetch. */
  refreshArtCache?(): Promise<void>;
  /** Optional: export liked songs as JSON. */
  exportLikes?(): Promise<string>;
  /** Optional: import liked songs from JSON. Returns number of imported tracks. */
  importLikes?(json: string): Promise<number>;
  /** Optional: refresh metadata for liked tracks. */
  refreshLikedMetadata?(): Promise<{ updated: number; removed: number }>;
}

// -----------------------------------------------------------------------------
// Playback
// -----------------------------------------------------------------------------

export interface PlaybackProvider {
  readonly providerId: ProviderId;
  initialize(): Promise<void>;
  /** Play a single track by ref, optionally starting from a position. */
  playTrack(track: MediaTrack, options?: { positionMs?: number }): Promise<void>;
  /** Play a collection from optional offset (e.g. playlist from index). */
  playCollection?(collectionRef: CollectionRef, options?: { offset?: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(volume0to1: number): Promise<void>;
  getState(): Promise<PlaybackState | null>;
  /** Subscribe to state changes (returns unsubscribe). */
  subscribe(listener: (state: PlaybackState | null) => void): () => void;
  /** Optional: pre-warm resources for an upcoming track (e.g. fetch temporary links). Supplying positionMs lets the adapter prepare to resume at that offset. */
  prepareTrack?(track: MediaTrack, options?: { positionMs?: number }): void;
  /** Optional: re-fetch album art for the currently playing track. */
  refreshCurrentTrackArt?(): void;
  /** Optional: epoch ms of the last playTrack call (used by auto-advance cooldown). */
  getLastPlayTime?(): number;
  /** Optional: notify the provider that the app queue changed (e.g. for native queue sync). */
  onQueueChanged?(tracks: MediaTrack[], fromIndex: number): void;
}

// -----------------------------------------------------------------------------
// Provider descriptor (for settings UI and registry)
// -----------------------------------------------------------------------------

export interface ProviderCapabilities {
  hasLikedCollection: boolean;
  hasSaveTrack: boolean;
  hasSaveAlbum?: boolean;
  hasDeleteCollection?: boolean;
  hasExternalLink: boolean;
  /** e.g. "Open in Spotify" */
  externalLinkLabel?: string;
  /** Provider supports cross-provider track search/resolution. */
  hasTrackSearch?: boolean;
  /** Provider syncs its native queue with the app queue. */
  hasNativeQueueSync?: boolean;
}

export interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;
  auth: AuthProvider;
  catalog: CatalogProvider;
  playback: PlaybackProvider;
  /** Brand color (hex) for UI theming. */
  color?: string;
  /** Short note shown on the auth screen (e.g. "Requires Spotify Premium."). */
  subscriptionNote?: string;
  /** Icon component for provider branding. */
  icon?: ComponentType<{ size?: number }>;
  /** Window event name dispatched when this provider's liked tracks change. */
  likesChangedEvent?: string;
  /** Build an external URL for an artist or album (e.g. Discogs search). */
  getExternalUrl?(info: { type: 'artist' | 'album'; name: string; artistName?: string }): string;
  /** Build multiple external URLs for an artist or album. Takes precedence over getExternalUrl. */
  getExternalUrls?(info: { type: 'artist' | 'album'; name: string; artistName?: string }): Array<{ label: string; url: string; icon: string }>;
  /** Optional: save a list of tracks as a new playlist. */
  savePlaylist?(name: string, tracks: MediaTrack[]): Promise<{ url?: string; totalTracks: number; skippedTracks: number } | null>;
}

/** Registry of available providers; used by app to resolve active provider by id. */
export interface ProviderRegistry {
  get(id: ProviderId): ProviderDescriptor | undefined;
  getAll(): ProviderDescriptor[];
  has(id: ProviderId): boolean;
}
