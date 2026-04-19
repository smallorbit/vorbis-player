/**
 * Spotify PlaybackProvider adapter.
 * Wraps the existing spotifyPlayer singleton.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { apiPlayTrack } from '@/services/spotifyPlayerPlayback';
import { spotifyAuth } from '@/services/spotify';
import { isAlbumId, extractAlbumId } from '@/constants/playlist';
import { SPOTIFY_MAX_RETRIES, SPOTIFY_BASE_BACKOFF_MS } from '@/constants/spotify';
import { SPOTIFY_DEVICE_ACTIVATE_RETRIES, SPOTIFY_DEVICE_ACTIVATE_DELAY_MS } from '@/constants/timing';
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

export class SpotifyPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'spotify';
  private static readonly READY_TIMEOUT_MS = 10_000;
  private static readonly READY_POLL_MS = 200;

  private pendingUpcomingUris: string[] | null = null;
  /** True after the first successful playTrack; lets subsequent plays skip heavy API checks. */
  private playbackSessionActive = false;

  private readonly listeners = new Set<(state: PlaybackState | null) => void>();
  private sdkUnsubscribe: (() => void) | null = null;
  /** Ref of the track most recently staged by prepareTrack; used for idempotency. */
  private preparedTrackRef: string | null = null;

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

  /**
   * Fast path for consecutive plays: skip API calls when the player is locally
   * known to be ready. Falls back to full ensurePlaybackReady() if local state
   * indicates the device went away.
   */
  private async ensurePlaybackReadyFastPath(): Promise<void> {
    if (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
      logSpotify('fast-path: device not ready locally, falling back to full check');
      this.playbackSessionActive = false;
      return this.ensurePlaybackReady();
    }
    logSpotify('fast-path: device locally ready, skipping transfer + active checks');
  }

  async initialize(): Promise<void> {
    await spotifyPlayer.initialize();
  }

  async playTrack(track: MediaTrack, options?: { positionMs?: number }): Promise<void> {
    const uri = track.playbackRef.ref;
    const startPositionMs = options?.positionMs;

    // If Spotify's SDK already natively advanced to this track, skip the API call entirely.
    if (this.playbackSessionActive && !startPositionMs) {
      const state = await spotifyPlayer.getCurrentState();
      if (state?.track_window?.current_track?.uri === uri && !state.paused) {
        logSpotify('Spotify already playing requested track natively, skipping API call');
        return;
      }
    }

    if (this.playbackSessionActive) {
      await this.ensurePlaybackReadyFastPath();
    } else {
      await this.ensurePlaybackReady();
    }

    const upcomingUris = this.pendingUpcomingUris ?? undefined;

    await this.playWithRetry(uri, track.name, upcomingUris, 0, startPositionMs);
    this.playbackSessionActive = true;

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
    positionMs?: number,
  ): Promise<void> {
    try {
      await spotifyPlayer.playTrack(uri, upcomingUris, positionMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
        throw new AuthExpiredError('spotify');
      }

      if (retryCount >= SPOTIFY_MAX_RETRIES) {
        throw error;
      }

      if (message.includes('429')) {
        const retryAfterMatch = message.match(/retry.?after[:\s]+(\d+)/i);
        const retryAfterSec = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : 0;
        const backoffMs = retryAfterSec > 0
          ? retryAfterSec * 1000
          : SPOTIFY_BASE_BACKOFF_MS * Math.pow(2, retryCount);
        logSpotify('429 during play, retrying (%d/%d) after %dms', retryCount + 1, SPOTIFY_MAX_RETRIES, backoffMs);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.playWithRetry(uri, trackName, upcomingUris, retryCount + 1, positionMs);
      }

      if (message.includes('403')) {
        if (message.includes('Restriction violated')) {
          throw new UnavailableTrackError(trackName);
        }

        this.playbackSessionActive = false;
        const backoffMs = SPOTIFY_BASE_BACKOFF_MS * Math.pow(2, retryCount);
        logSpotify('403 during play, retrying (%d/%d) after %dms', retryCount + 1, SPOTIFY_MAX_RETRIES, backoffMs);
        await spotifyPlayer.transferPlaybackToDevice(true);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        await spotifyPlayer.ensureDeviceIsActive(SPOTIFY_DEVICE_ACTIVATE_RETRIES, SPOTIFY_DEVICE_ACTIVATE_DELAY_MS);
        return this.playWithRetry(uri, trackName, upcomingUris, retryCount + 1, positionMs);
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
    this.listeners.add(listener);
    this.ensureSdkSubscription();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.sdkUnsubscribe?.();
        this.sdkUnsubscribe = null;
      }
    };
  }

  private ensureSdkSubscription(): void {
    if (this.sdkUnsubscribe) return;
    this.sdkUnsubscribe = spotifyPlayer.onPlayerStateChanged((spotifyState) => {
      this.emitState(mapPlaybackState(spotifyState));
    });
  }

  private emitState(state: PlaybackState | null): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[spotifyPlayback] listener error:', err);
      }
    }
  }

  getLastPlayTime(): number {
    return spotifyPlayer.lastPlayTrackTime;
  }

  prepareTrack(track: MediaTrack, options?: { positionMs?: number }): void {
    const uri = track.playbackRef.ref;
    // Idempotency: same-URI repeat calls are a no-op so the state event isn't
    // emitted twice for the same prepared track. A different URI re-primes.
    if (this.preparedTrackRef === uri) {
      return;
    }
    this.preparedTrackRef = uri;

    void this.stageTrackPaused(track, options?.positionMs ?? 0).catch((err) => {
      logSpotify('prepareTrack failed: %o', err);
      // Allow another attempt if the stage failed.
      if (this.preparedTrackRef === uri) {
        this.preparedTrackRef = null;
      }
    });
  }

  /**
   * Transfer playback to our device, loaded on `track` at `positionMs` and paused.
   * Emits a PlaybackState event so subscribers (seek bar, duration readout) reflect
   * the staged state before the user presses play.
   */
  private async stageTrackPaused(track: MediaTrack, positionMs: number): Promise<void> {
    await this.ensurePlaybackReady();

    const deviceId = spotifyPlayer.getDeviceId();
    if (!deviceId) return;

    // Spotify's Web API has no "load paused at position" primitive, so we start
    // playback at the saved offset then immediately pause. The net effect from
    // the user's perspective is the track appearing as the paused context on
    // this device (and mirrored on other Spotify Connect clients).
    const positionFloor = Math.floor(positionMs);
    await apiPlayTrack(deviceId, track.playbackRef.ref, undefined, positionFloor);
    await spotifyPlayer.pause();

    this.emitState({
      isPlaying: false,
      positionMs: positionFloor,
      durationMs: track.durationMs ?? 0,
      currentTrackId: track.id,
      currentPlaybackRef: track.playbackRef,
    });
  }

  onQueueChanged(tracks: MediaTrack[], fromIndex: number): void {
    this.pendingUpcomingUris = spotifyQueueSync.buildUpcomingUris(tracks, fromIndex);
  }
}
