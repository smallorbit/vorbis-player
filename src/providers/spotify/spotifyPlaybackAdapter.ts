/**
 * Spotify PlaybackProvider adapter.
 * Wraps the existing spotifyPlayer singleton.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { spotifyAuth } from '@/services/spotify';
import { isAlbumId, extractAlbumId } from '@/constants/playlist';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { spotifyQueueSync } from './spotifyQueueSync';
import { logSpotify } from '@/lib/debugLog';

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

const MAX_PLAY_RETRIES = 2;
const BASE_RETRY_BACKOFF_MS = 1500;

export class SpotifyPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'spotify';
  private static readonly READY_TIMEOUT_MS = 10_000;
  private static readonly READY_POLL_MS = 200;

  private pendingUpcomingUris: string[] | null = null;

  private async waitForPlayerReady(): Promise<void> {
    const start = Date.now();
    while (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
      if (Date.now() - start > SpotifyPlaybackAdapter.READY_TIMEOUT_MS) {
        throw new Error('Spotify player not ready after waiting');
      }
      await new Promise(resolve => setTimeout(resolve, SpotifyPlaybackAdapter.READY_POLL_MS));
    }
  }

  private async ensurePlaybackReady(): Promise<void> {
    await spotifyPlayer.initialize();
    await this.waitForPlayerReady();
    await spotifyPlayer.transferPlaybackToDevice();
    await spotifyPlayer.ensureDeviceIsActive();
  }

  async initialize(): Promise<void> {
    await spotifyPlayer.initialize();
  }

  async playTrack(track: MediaTrack): Promise<void> {
    await this.ensurePlaybackReady();

    const uri = track.playbackRef.ref;
    const upcomingUris = this.pendingUpcomingUris ?? undefined;

    await this.playWithRetry(uri, track.name, upcomingUris);

    const activateDevice = async () => {
      try {
        const token = await spotifyAuth.ensureValidToken();
        const deviceId = spotifyPlayer.getDeviceId();
        if (deviceId) {
          await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              device_ids: [deviceId],
              play: true,
            }),
          });
        }
      } catch (error) {
        console.error('Failed to activate device:', error);
      }
    };

    spotifyPlayer.waitForPlaybackOrResume(activateDevice);
  }

  private async playWithRetry(
    uri: string,
    trackName: string,
    upcomingUris?: string[],
    retryCount = 0,
  ): Promise<void> {
    try {
      await spotifyPlayer.playTrack(uri, upcomingUris);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        throw new AuthExpiredError('spotify');
      }

      if (message.includes('403')) {
        if (message.includes('Restriction violated')) {
          throw new UnavailableTrackError(trackName);
        }

        if (retryCount < MAX_PLAY_RETRIES) {
          const backoffMs = BASE_RETRY_BACKOFF_MS * Math.pow(2, retryCount);
          logSpotify('403 during play, retrying (%d/%d) after %dms', retryCount + 1, MAX_PLAY_RETRIES, backoffMs);
          await spotifyPlayer.transferPlaybackToDevice();
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          await spotifyPlayer.ensureDeviceIsActive(3, 1000);
          return this.playWithRetry(uri, trackName, upcomingUris, retryCount + 1);
        }
      }

      throw error;
    }
  }

  async playCollection(
    collectionRef: CollectionRef,
    options?: { offset?: number },
  ): Promise<void> {
    await this.ensurePlaybackReady();
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

  getLastPlayTime(): number {
    return spotifyPlayer.lastPlayTrackTime;
  }

  onQueueChanged(tracks: MediaTrack[], fromIndex: number): void {
    const legacyTracks = tracks.map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists ?? '',
      album: t.album ?? '',
      album_id: t.albumId ?? '',
      duration_ms: t.durationMs ?? 0,
      image: t.image ?? '',
      uri: t.playbackRef.ref,
      provider: t.provider,
      track_number: t.trackNumber,
    }));

    this.pendingUpcomingUris = spotifyQueueSync.buildUpcomingUris(legacyTracks, fromIndex);
  }
}
