/**
 * Dropbox PlaybackProvider adapter.
 * Uses the HTML5 Audio API to play audio files streamed from Dropbox temporary links.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { DropboxCatalogAdapter } from './dropboxCatalogAdapter';
import { parseID3 } from '@/utils/id3Parser';
import { bytesToDataUrl } from '@/utils/bytesToDataUrl';
import { putDurationMs } from './dropboxArtCache';

export class DropboxPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'dropbox';
  private audio: HTMLAudioElement | null = null;
  private currentTrack: MediaTrack | null = null;
  private listeners = new Set<(state: PlaybackState | null) => void>();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private pendingMetadataUpdate: PlaybackState['trackMetadata'] | null = null;
  private pendingDurationMs: number | null = null;
  private pendingError: PlaybackState['playbackError'] | null = null;

  private catalog: DropboxCatalogAdapter;

  constructor(catalog: DropboxCatalogAdapter) {
    this.catalog = catalog;
  }

  async initialize(): Promise<void> {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';

      this.audio.addEventListener('play', () => this.notifyListeners());
      this.audio.addEventListener('pause', () => this.notifyListeners());
      this.audio.addEventListener('ended', () => this.notifyListeners());
      this.audio.addEventListener('timeupdate', () => this.notifyListeners());
      this.audio.addEventListener('loadedmetadata', () => {
        const dur = this.audio!.duration;
        if (!isNaN(dur) && dur > 0 && this.currentTrack) {
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
  }

  async playTrack(track: MediaTrack): Promise<void> {
    if (!this.audio) await this.initialize();

    const dropboxPath = track.playbackRef.ref;
    const streamUrl = await this.catalog.getTemporaryLink(dropboxPath);

    this.currentTrack = track;
    this.pendingMetadataUpdate = null;
    this.pendingDurationMs = null;
    this.audio!.src = streamUrl;
    await this.audio!.play();

    this.startUpdateInterval();
    this.enrichMetadataInBackground(track, streamUrl);
  }

  private enrichMetadataInBackground(track: MediaTrack, streamUrl: string): void {
    const FETCH_LIMIT = 262144; // 256KB — enough to cover large embedded cover art in ID3 headers

    const doEnrich = async () => {
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

      const { title, artist, album, coverArt } = parseID3(combined.buffer as ArrayBuffer);
      const update: PlaybackState['trackMetadata'] = {};
      if (title && title !== track.name) update.name = title;
      if (artist && artist !== track.artists) update.artists = artist;
      if (album && album !== track.album) update.album = album;
      if (coverArt && !track.image) {
        update.image = bytesToDataUrl(coverArt.data, coverArt.mimeType);
      }
      if (Object.keys(update).length > 0) {
        this.currentTrack = { ...track, ...update };
        this.pendingMetadataUpdate = update;
        this.notifyListeners();
      }
    };

    doEnrich().catch(() => {
      // Metadata enrichment is best-effort; ignore failures
    });
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

    const state: PlaybackState = {
      isPlaying: !this.audio.paused && !this.audio.ended,
      positionMs: Math.floor(this.audio.currentTime * 1000),
      durationMs: isNaN(this.audio.duration) ? 0 : Math.floor(this.audio.duration * 1000),
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
    // Poll every 250ms for smooth timeline updates
    this.updateInterval = setInterval(() => {
      if (this.audio && !this.audio.paused) {
        this.notifyListeners();
      }
    }, 250);
  }

  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
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
