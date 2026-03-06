/**
 * Provider contracts: Auth, Catalog, and Playback.
 * All music sources (Spotify, Dropbox, future) implement these interfaces.
 */

import type { MediaTrack, MediaCollection, CollectionRef, PlaybackState, ProviderId } from './domain';

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

export interface AuthProvider {
  readonly providerId: ProviderId;
  isAuthenticated(): boolean;
  getAccessToken(): Promise<string | null>;
  /** Start OAuth (redirect or open popup). */
  beginLogin(): Promise<void>;
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
  listCollections(signal?: AbortSignal): Promise<MediaCollection[]>;
  /** List tracks for a collection. */
  listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]>;
  /** Optional: total count for "Liked" or similar (Spotify). */
  getLikedCount?(signal?: AbortSignal): Promise<number>;
  /** Optional: save/unsave track (Spotify liked). */
  setTrackSaved?(trackId: string, saved: boolean): Promise<void>;
  isTrackSaved?(trackId: string): Promise<boolean>;
}

// -----------------------------------------------------------------------------
// Playback
// -----------------------------------------------------------------------------

export interface PlaybackProvider {
  readonly providerId: ProviderId;
  initialize(): Promise<void>;
  /** Play a single track by ref. */
  playTrack(track: MediaTrack): Promise<void>;
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
}

// -----------------------------------------------------------------------------
// Provider descriptor (for settings UI and registry)
// -----------------------------------------------------------------------------

export interface ProviderCapabilities {
  hasLikedCollection: boolean;
  hasSaveTrack: boolean;
  hasExternalLink: boolean;
  /** e.g. "Open in Spotify" */
  externalLinkLabel?: string;
}

export interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;
  auth: AuthProvider;
  catalog: CatalogProvider;
  playback: PlaybackProvider;
  /** Build an external URL for an artist or album (e.g. Discogs search). */
  getExternalUrl?(info: { type: 'artist' | 'album'; name: string; artistName?: string }): string;
  /** Build multiple external URLs for an artist or album. Takes precedence over getExternalUrl. */
  getExternalUrls?(info: { type: 'artist' | 'album'; name: string; artistName?: string }): Array<{ label: string; url: string; icon: string }>;
}

/** Registry of available providers; used by app to resolve active provider by id. */
export interface ProviderRegistry {
  get(id: ProviderId): ProviderDescriptor | undefined;
  getAll(): ProviderDescriptor[];
  has(id: ProviderId): boolean;
}
