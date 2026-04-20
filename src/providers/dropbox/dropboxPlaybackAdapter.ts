/**
 * Dropbox PlaybackProvider adapter.
 * Uses the HTML5 Audio API to play audio files streamed from Dropbox temporary links.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { DropboxCatalogAdapter } from './dropboxCatalogAdapter';
import { parseID3 } from '@/utils/id3Parser';
import { bytesToDataUrl } from '@/utils/bytesToDataUrl';
import { putDurationMs, putTagMetadata } from './dropboxArtCache';

const PLAYBACK_POLL_INTERVAL_MS = 250;
const FETCH_LIMIT = 262144; // 256KB — enough to cover large embedded cover art in ID3 headers
const ENRICHMENT_DELAY_MS = 2000; // Wait for audio to buffer before fetching ID3 tags

export class DropboxPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'dropbox';
  private audio: HTMLAudioElement | null = null;
  private currentTrack: MediaTrack | null = null;
  private listeners = new Set<(state: PlaybackState | null) => void>();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private pendingMetadataUpdate: PlaybackState['trackMetadata'] | null = null;
  private pendingDurationMs: number | null = null;
  private pendingError: PlaybackState['playbackError'] | null = null;
  private prepareGeneration = 0;

  private catalog: DropboxCatalogAdapter;
  private lastPlayTime = 0;

  constructor(catalog: DropboxCatalogAdapter) {
    this.catalog = catalog;
  }

  private ensureAudio(): void {
    if (this.audio) return;
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('play', () => this.notifyListeners());
    this.audio.addEventListener('pause', () => this.notifyListeners());
    this.audio.addEventListener('ended', () => this.notifyListeners());
    this.audio.addEventListener('timeupdate', () => this.notifyListeners());
    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio!.duration;
      if (Number.isFinite(dur) && dur > 0 && this.currentTrack) {
        const durationMs = Math.floor(dur * 1000);
        this.pendingDurationMs = durationMs;
        putDurationMs(this.currentTrack.id, durationMs).catch(() => {});
      }
      this.notifyListeners();
    });
    this.audio.addEventListener('error', () => {
      const mediaError = this.audio?.error;
      this.pendingError = {
        code: mediaError?.code ?? 0,
        message: mediaError?.message || `MediaError code ${mediaError?.code ?? 0}`,
      };
      console.error('[DropboxPlayback] Audio error:', mediaError);
      this.notifyListeners();
    });
  }

  async initialize(): Promise<void> {
    this.ensureAudio();
  }

  async playTrack(track: MediaTrack, options?: { positionMs?: number }): Promise<void> {
    this.ensureAudio();
    // Invalidate any pending prepareTrack so it can't emit stale state for the old src.
    this.prepareGeneration += 1;

    const dropboxPath = track.playbackRef.ref;

    // iOS Safari requires audio.play() to be called within the synchronous
    // user-gesture call stack to register this element as user-activated.
    // Calling it here (before any await) ensures the subsequent async play()
    // — after the Dropbox URL fetch — succeeds on iOS even though the
    // network request breaks the gesture activation window.
    if (this.audio!.paused) {
      this.audio!.play().catch(() => {});
    }

    const streamUrl = await this.catalog.getTemporaryLink(dropboxPath);

    this.currentTrack = track;
    this.lastPlayTime = Date.now();
    this.hydrateAlbumArtFromCache(track);
    this.pendingMetadataUpdate = null;
    this.pendingDurationMs = null;
    this.audio!.pause();
    this.audio!.src = streamUrl;
    await this.audio!.play();

    if (options?.positionMs) {
      this.audio!.currentTime = options.positionMs / 1000;
    }

    this.startUpdateInterval();
    this.enrichMetadataInBackground(track, streamUrl);
  }

  private hydrateAlbumArtFromCache(track: MediaTrack): void {
    if (track.image || !track.albumId) return;
    this.catalog.getAlbumArtForAlbum(track.albumId)
      .then((cachedImage) => {
        if (!cachedImage) return;
        if (this.currentTrack?.id !== track.id) return;
        if (this.currentTrack.image) return;

        this.currentTrack = { ...this.currentTrack, image: cachedImage };
        this.pendingMetadataUpdate = {
          ...(this.pendingMetadataUpdate ?? {}),
          image: cachedImage,
        };
        this.notifyListeners();
      })
      .catch(() => {
        // Best-effort cache hydration.
      });
  }

  private enrichMetadataInBackground(track: MediaTrack, streamUrl: string): void {
    const doEnrich = async () => {
      // Let the audio element buffer first before competing for bandwidth
      await new Promise((resolve) => setTimeout(resolve, ENRICHMENT_DELAY_MS));
      // Bail if track changed during the delay
      if (this.currentTrack?.id !== track.id) return;
      let res: Response;
      try {
        res = await fetch(streamUrl, { headers: { Range: `bytes=0-${FETCH_LIMIT - 1}` } });
      } catch {
        return;
      }

      if ((!res.ok && res.status !== 206) || !res.body) return;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      try {
        while (totalBytes < FETCH_LIMIT) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          totalBytes += value.length;
        }
      } finally {
        reader.cancel();
      }

      if (this.currentTrack?.id !== track.id) return;

      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const { title, artist, album, coverArt, musicbrainzRecordingId, musicbrainzArtistId, isrc } = parseID3(combined.buffer as ArrayBuffer);
      const update: PlaybackState['trackMetadata'] = {};
      if (title && title !== track.name) update.name = title;
      if (artist && artist !== track.artists) update.artists = artist;
      if (album && album !== track.album) update.album = album;
      if (coverArt && !this.currentTrack?.image) {
        update.image = bytesToDataUrl(coverArt.data, coverArt.mimeType);
        if (track.albumId) {
          this.catalog.cacheAlbumArtForAlbum(track.albumId, update.image).catch(() => {});
        }
      }

      if (title || artist || album) {
        putTagMetadata(track.id, {
          ...(title ? { name: title } : {}),
          ...(artist ? { artists: artist } : {}),
          ...(album ? { album } : {}),
        }).catch(() => {});
      }

      // MusicBrainz IDs go directly on the track (not via trackMetadata)
      const mbUpdate: Partial<MediaTrack> = {};
      if (musicbrainzRecordingId) mbUpdate.musicbrainzRecordingId = musicbrainzRecordingId;
      if (musicbrainzArtistId) mbUpdate.musicbrainzArtistId = musicbrainzArtistId;
      if (isrc) mbUpdate.isrc = isrc;

      if (Object.keys(update).length > 0 || Object.keys(mbUpdate).length > 0) {
        this.currentTrack = { ...(this.currentTrack ?? track), ...update, ...mbUpdate };
        if (Object.keys(update).length > 0) {
          this.pendingMetadataUpdate = update;
        }
        this.notifyListeners();
      }
    };

    doEnrich().catch(() => {
      // Metadata enrichment is best-effort; ignore failures
    });
  }

  prepareTrack(track: MediaTrack, options?: { positionMs?: number }): void {
    this.catalog.prefetchTemporaryLink(track.playbackRef.ref);
    this.primeAudioForHydrate(track, options?.positionMs).catch(() => {
      // Hydration is best-effort; playTrack will retry when invoked.
    });
  }

  private async primeAudioForHydrate(track: MediaTrack, positionMs?: number): Promise<void> {
    this.ensureAudio();
    const audio = this.audio!;
    // Only prime audio when nothing is loaded — during next-track pre-warm
    // the current src is mid-playback and must not be replaced.
    if (audio.src && this.currentTrack) return;

    const generation = ++this.prepareGeneration;

    const streamUrl = await this.catalog.getTemporaryLink(track.playbackRef.ref);
    if (generation !== this.prepareGeneration) return;

    audio.src = streamUrl;

    if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve) => {
        // Resolve on either signal so the prime unblocks even when the
        // resource fails to load. The generation re-check below drops stale
        // primes, and the error fallback emits durationMs: 0 via getStateSync.
        const onSettle = () => {
          audio.removeEventListener('loadedmetadata', onSettle);
          audio.removeEventListener('error', onSettle);
          resolve();
        };
        audio.addEventListener('loadedmetadata', onSettle);
        audio.addEventListener('error', onSettle);
      });
    }
    if (generation !== this.prepareGeneration) return;

    // Commit track state only after metadata has settled and this prime
    // hasn't been superseded, so getStateSync can't observe a mixed state
    // where currentTrack points at a not-yet-loaded src.
    this.currentTrack = track;
    this.hydrateAlbumArtFromCache(track);

    if (positionMs && positionMs > 0) {
      audio.currentTime = positionMs / 1000;
    }

    // The ensureAudio loadedmetadata listener short-circuits when it fires
    // before currentTrack is set (see the guard there), so populate the
    // persisted-duration side effects ourselves now that currentTrack is live.
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0) {
      const durationMs = Math.floor(dur * 1000);
      this.pendingDurationMs = durationMs;
      putDurationMs(track.id, durationMs).catch(() => {});
    }

    this.notifyListeners();
  }

  refreshCurrentTrackArt(): void {
    const track = this.currentTrack;
    if (!track || track.image) return;

    // Try album art from Dropbox folder (cover.jpg etc.)
    if (track.albumId) {
      this.catalog.resolveAlbumArt(track.albumId).then((imageUrl) => {
        if (!imageUrl) return;
        if (this.currentTrack?.id !== track.id) return;
        if (this.currentTrack.image) return;

        this.currentTrack = { ...this.currentTrack, image: imageUrl };
        this.pendingMetadataUpdate = {
          ...(this.pendingMetadataUpdate ?? {}),
          image: imageUrl,
        };
        this.notifyListeners();
      }).catch(() => {});
    }

    // Also re-attempt ID3 tag extraction for embedded cover art
    const dropboxPath = track.playbackRef.ref;
    this.catalog.getTemporaryLink(dropboxPath).then((streamUrl) => {
      this.enrichMetadataInBackground(track, streamUrl);
    }).catch(() => {});
  }

  async playCollection(
    _collectionRef: CollectionRef,
    _options?: { offset?: number },
  ): Promise<void> {
    // Dropbox doesn't have native collection playback.
    // The app handles track-by-track playback via usePlaylistManager.
  }

  async pause(): Promise<void> {
    this.audio?.pause();
  }

  async resume(): Promise<void> {
    await this.audio?.play();
  }

  async seek(positionMs: number): Promise<void> {
    if (this.audio) {
      this.audio.currentTime = positionMs / 1000;
    }
  }

  async next(): Promise<void> {
    // Managed at the hook level via useAutoAdvance
  }

  async previous(): Promise<void> {
    // Managed at the hook level
  }

  async setVolume(volume0to1: number): Promise<void> {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume0to1));
    }
  }

  async getState(): Promise<PlaybackState | null> {
    return this.getStateSync();
  }

  subscribe(listener: (state: PlaybackState | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopUpdateInterval();
      }
    };
  }

  private notifyListeners(): void {
    const state = this.getStateSync();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[DropboxPlayback] Listener error:', err);
      }
    }
  }

  private getStateSync(): PlaybackState | null {
    if (!this.audio || !this.currentTrack) return null;

    const rawDuration = this.audio.duration;
    const state: PlaybackState = {
      isPlaying: !this.audio.paused && !this.audio.ended,
      positionMs: Math.floor(this.audio.currentTime * 1000),
      durationMs: Number.isFinite(rawDuration) ? Math.floor(rawDuration * 1000) : 0,
      currentTrackId: this.currentTrack.id,
      currentPlaybackRef: this.currentTrack.playbackRef,
    };

    if (this.pendingMetadataUpdate || this.pendingDurationMs !== null) {
      state.trackMetadata = {
        ...this.pendingMetadataUpdate,
        ...(this.pendingDurationMs !== null ? { durationMs: this.pendingDurationMs } : {}),
      };
      this.pendingMetadataUpdate = null;
      this.pendingDurationMs = null;
    }

    if (this.pendingError) {
      state.playbackError = this.pendingError;
      this.pendingError = null;
    }

    return state;
  }

  private startUpdateInterval(): void {
    this.stopUpdateInterval();
    this.updateInterval = setInterval(() => {
      if (this.audio && !this.audio.paused) {
        this.notifyListeners();
      }
    }, PLAYBACK_POLL_INTERVAL_MS);
  }

  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  getLastPlayTime(): number {
    return this.lastPlayTime;
  }

  onQueueChanged(_tracks: MediaTrack[], _fromIndex: number): void {
    // No-op for Dropbox
  }

  destroy(): void {
    this.stopUpdateInterval();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.currentTrack = null;
    this.listeners.clear();
  }
}
