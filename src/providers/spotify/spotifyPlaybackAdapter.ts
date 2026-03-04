/**
 * Spotify PlaybackProvider adapter.
 * Wraps the existing spotifyPlayer singleton.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { isAlbumId, extractAlbumId } from '@/constants/playlist';

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
    await spotifyPlayer.playTrack(track.playbackRef.ref);
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
    // Spotify seek uses the Web API
    const { spotifyAuth } = await import('@/services/spotify');
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
