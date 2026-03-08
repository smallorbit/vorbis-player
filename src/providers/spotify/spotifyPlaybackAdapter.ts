/**
 * Spotify PlaybackProvider adapter.
 * Wraps the existing spotifyPlayer singleton.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { isAlbumId, extractAlbumId } from '@/constants/playlist';
import { spotifyAuth } from '@/services/spotify';

/** Map a SpotifyPlaybackState to the provider-agnostic PlaybackState. */
function mapPlaybackState(state: SpotifyPlaybackState | null): PlaybackState | null {
  if (!state) return null;

  const currentTrack = state.track_window?.current_track;
  return {
    isPlaying: !state.paused,
    positionMs: state.position,
    durationMs: currentTrack?.duration_ms ?? 0,
    currentTrackId: currentTrack?.id ?? null,
    currentPlaybackRef: currentTrack
      ? { provider: 'spotify', ref: currentTrack.uri }
      : null,
  };
}

export class SpotifyPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'spotify';

  async initialize(): Promise<void> {
    await spotifyPlayer.initialize();
  }

  async playTrack(track: MediaTrack): Promise<void> {
    const uri = track.playbackRef.ref;
    const success = await this.playWithRetry(uri);
    if (!success) {
      throw new Error(`Track "${track.name}" is unavailable for playback`);
    }

    // Wait briefly, then resume if the SDK left playback paused at position 0
    setTimeout(() => {
      void this.ensurePlaybackStarted();
    }, 1500);
  }

  /**
   * Attempts to play a Spotify URI, retrying on recoverable 403 errors
   * (e.g. device not found) with exponential backoff.  Unrecoverable
   * "Restriction violated" 403s return false immediately.
   */
  private async playWithRetry(
    trackUri: string,
    retryCount = 0,
    maxRetries = 2,
  ): Promise<boolean> {
    try {
      await spotifyPlayer.playTrack(trackUri);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('403')) {
        if (msg.includes('Restriction violated')) {
          return false; // Unrecoverable
        }
        if (retryCount < maxRetries) {
          const backoffMs = 1500 * Math.pow(2, retryCount);
          await spotifyPlayer.transferPlaybackToDevice();
          await new Promise((r) => setTimeout(r, backoffMs));
          await spotifyPlayer.ensureDeviceIsActive(3, 1000);
          return this.playWithRetry(trackUri, retryCount + 1, maxRetries);
        }
      }

      throw error;
    }
  }

  /** After a playTrack call, verify the SDK actually started playing. */
  private async ensurePlaybackStarted(): Promise<void> {
    try {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        if (state.paused && state.position === 0) {
          await spotifyPlayer.resume();
        }
      } else {
        // No state means the device is not active — reactivate
        const token = await spotifyAuth.ensureValidToken();
        const deviceId = spotifyPlayer.getDeviceId();
        if (deviceId) {
          await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_ids: [deviceId], play: true }),
          });
        }
      }
    } catch (err) {
      console.error('[SpotifyPlayback] Failed to ensure playback started:', err);
    }
  }

  async playCollection(
    collectionRef: CollectionRef,
    options?: { offset?: number },
  ): Promise<void> {
    // Use Spotify context-based playback for playlists
    if (collectionRef.kind === 'playlist') {
      await spotifyPlayer.playContext(
        `spotify:playlist:${collectionRef.id}`,
        options?.offset,
      );
    } else if (collectionRef.kind === 'album') {
      const albumId = isAlbumId(collectionRef.id)
        ? extractAlbumId(collectionRef.id)
        : collectionRef.id;
      await spotifyPlayer.playContext(
        `spotify:album:${albumId}`,
        options?.offset,
      );
    }
  }

  async pause(): Promise<void> {
    await spotifyPlayer.pause();
  }

  async resume(): Promise<void> {
    await spotifyPlayer.resume();
  }

  async seek(positionMs: number): Promise<void> {
    const token = await spotifyAuth.ensureValidToken();
    const deviceId = spotifyPlayer.getDeviceId();
    if (!deviceId) return;

    await fetch(
      `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${deviceId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async next(): Promise<void> {
    await spotifyPlayer.nextTrack();
  }

  async previous(): Promise<void> {
    await spotifyPlayer.previousTrack();
  }

  async setVolume(volume0to1: number): Promise<void> {
    await spotifyPlayer.setVolume(volume0to1);
  }

  async getState(): Promise<PlaybackState | null> {
    const state = await spotifyPlayer.getCurrentState();
    return mapPlaybackState(state);
  }

  subscribe(listener: (state: PlaybackState | null) => void): () => void {
    return spotifyPlayer.onPlayerStateChanged((spotifyState) => {
      listener(mapPlaybackState(spotifyState));
    });
  }
}
