/**
 * Spotify PlaybackProvider adapter.
 * Wraps the existing spotifyPlayer singleton.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { spotifyAuth } from '@/services/spotify';
import { isAlbumId, extractAlbumId } from '@/constants/playlist';
import { SPOTIFY_MAX_RETRIES, SPOTIFY_BASE_BACKOFF_MS } from '@/constants/spotify';
import { SPOTIFY_DEVICE_ACTIVATE_RETRIES, SPOTIFY_DEVICE_ACTIVATE_DELAY_MS } from '@/constants/timing';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { spotifyQueueSync } from './spotifyQueueSync';
import { logSpotify, logArtRace } from '@/lib/debugLog';

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
      const mapped = mapPlaybackState(spotifyState);
      logArtRace('spotify.sdk: emitState source=SDK currentTrackId=%s isPlaying=%s positionMs=%d',
        mapped?.currentTrackId ? mapped.currentTrackId.slice(0, 8) : 'null',
        String(mapped?.isPlaying ?? 'null'),
        mapped?.positionMs ?? -1);
      this.emitState(mapped);
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

  async probePlayable(track: MediaTrack): Promise<boolean> {
    const uri = track.playbackRef.ref;
    const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri);
    if (!match) return false;
    const trackId = match[1];
    const token = await spotifyAuth.ensureValidToken();
    const res = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}?market=from_token`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401) throw new AuthExpiredError('spotify');
    if (res.status === 404) return false;
    if (!res.ok) {
      throw new Error(`Spotify probePlayable failed: ${res.status}`);
    }
    const body = (await res.json()) as { is_playable?: boolean };
    return body.is_playable !== false;
  }

  prepareTrack(track: MediaTrack, options?: { positionMs?: number }): void {
    // Warm the auth token unconditionally so a token refresh delay can't stall
    // the next transition even if the rest of the function early-returns.
    spotifyAuth.ensureValidToken().catch(() => {});

    // Pre-warm intent (no positionMs): the next-track pre-warm caller in
    // `useProviderPlayback.playTrack` doesn't pass options. The user is hearing
    // a *different* track, so emitting a PlaybackState with
    // `currentTrackId = nextTrack.id` would race the SDK's
    // `player_state_changed` for the playing track and flicker album art
    // (#1199 / `vorbis:art-race`). Device readiness is also unnecessary —
    // the next `playTrack` call runs its own `ensurePlaybackReadyFastPath`,
    // and the `/me/player` API call here adds nothing in steady state.
    if (options?.positionMs === undefined) {
      logArtRace('spotify.prepareTrack: skip (pre-warm intent) id=%s', track.id.slice(0, 8));
      return;
    }

    const uri = track.playbackRef.ref;
    if (this.preparedTrackRef === uri) {
      logArtRace('spotify.prepareTrack: skip (already prepared) id=%s', track.id.slice(0, 8));
      return;
    }
    this.preparedTrackRef = uri;

    logArtRace('spotify.prepareTrack: enter id=%s positionMs=%d intent=hydrate',
      track.id.slice(0, 8), options.positionMs);

    void this.stageTrackPaused(track, options.positionMs).catch((err) => {
      logSpotify('prepareTrack failed: %o', err);
      if (this.preparedTrackRef === uri) {
        this.preparedTrackRef = null;
      }
    });
  }

  private async stageTrackPaused(track: MediaTrack, positionMs: number): Promise<void> {
    // Emit the staged UI state synchronously — before awaiting the Connect
    // transfer — so the seek bar reflects the saved position and full duration
    // immediately on session hydrate, with no 0:00/0:00 window. The
    // preparedTrackRef guard above in prepareTrack() ensures this emit only
    // fires for the most-recently requested track.
    logArtRace('spotify.stageTrackPaused: emitState currentTrackId=%s positionMs=%d',
      track.id.slice(0, 8), Math.floor(positionMs));
    this.emitState({
      isPlaying: false,
      positionMs: Math.floor(positionMs),
      durationMs: track.durationMs ?? 0,
      currentTrackId: track.id,
      currentPlaybackRef: track.playbackRef,
    });

    // ensurePlaybackReady transfers Spotify Connect to this device with
    // `play: false`, which paused-transfers any existing session and leaves
    // the SDK ready. That's all the staging we need for hydrate — we do NOT
    // call apiPlayTrack, because /me/player/play starts audio and Spotify's
    // eventually-consistent server state makes a subsequent pause() race
    // the just-started playback (leaked audio on a fresh tab).
    //
    // Actual audio playback is deferred to the user's next `playTrack` call,
    // which starts from the saved position via handlePlay consuming
    // hydratedPendingPlayRef. The guard below drops the result if a newer
    // prepareTrack supersedes this one while the transfer is in flight.
    await this.ensurePlaybackReady();

    const uri = track.playbackRef.ref;
    if (this.preparedTrackRef !== uri) return;
  }

  onQueueChanged(tracks: MediaTrack[], fromIndex: number): void {
    this.pendingUpcomingUris = spotifyQueueSync.buildUpcomingUris(tracks, fromIndex);
  }
}
