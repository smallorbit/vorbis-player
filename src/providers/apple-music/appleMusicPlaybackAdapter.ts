/**
 * Apple Music PlaybackProvider adapter.
 * Wraps MusicKit JS playback engine.
 */

import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState } from '@/types/domain';
import { appleMusicService } from './appleMusicService';
import { MKPlaybackStates } from './appleMusicTypes';
import type { MKInstance } from './appleMusicTypes';

/** Throttle interval for playback time updates (ms). */
const TIME_UPDATE_THROTTLE_MS = 250;

export class AppleMusicPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId = 'apple-music';
  private listeners = new Set<(state: PlaybackState | null) => void>();
  private boundHandlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
  private lastTimeNotify = 0;

  async initialize(): Promise<void> {
    const instance = await appleMusicService.ensureLoaded();
    this.attachListeners(instance);
  }

  async playTrack(track: MediaTrack): Promise<void> {
    const instance = await appleMusicService.ensureLoaded();
    await instance.setQueue({ song: track.playbackRef.ref, startPlaying: true });
    // setQueue with startPlaying should start playback; call play() as fallback
    if (instance.playbackState !== MKPlaybackStates.playing) {
      await instance.play();
    }
  }

  async pause(): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) await instance.pause();
  }

  async resume(): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) await instance.play();
  }

  async seek(positionMs: number): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) await instance.seekToTime(positionMs / 1000);
  }

  async next(): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) await instance.skipToNextItem();
  }

  async previous(): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) await instance.skipToPreviousItem();
  }

  async setVolume(volume0to1: number): Promise<void> {
    const instance = appleMusicService.getInstance();
    if (instance) instance.volume = volume0to1;
  }

  async getState(): Promise<PlaybackState | null> {
    const instance = appleMusicService.getInstance();
    if (!instance) return null;
    return this.mapState(instance);
  }

  subscribe(listener: (state: PlaybackState | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private attachListeners(instance: MKInstance): void {
    // Detach any previously attached listeners
    this.detachListeners(instance);

    const stateHandler = () => this.notifyListeners(instance);
    const timeHandler = () => this.notifyListenersThrottled(instance);

    const events: Array<{ event: string; handler: (...args: unknown[]) => void }> = [
      { event: 'playbackStateDidChange', handler: stateHandler },
      { event: 'nowPlayingItemDidChange', handler: stateHandler },
      { event: 'playbackTimeDidChange', handler: timeHandler },
    ];

    for (const { event, handler } of events) {
      instance.addEventListener(event, handler);
    }
    this.boundHandlers = events;
  }

  private detachListeners(instance: MKInstance): void {
    for (const { event, handler } of this.boundHandlers) {
      instance.removeEventListener(event, handler);
    }
    this.boundHandlers = [];
  }

  private mapState(instance: MKInstance): PlaybackState {
    const item = instance.nowPlayingItem;
    const durationMs =
      instance.currentPlaybackDuration * 1000 || (item?.attributes?.durationInMillis ?? 0);
    return {
      isPlaying: instance.playbackState === MKPlaybackStates.playing,
      positionMs: instance.currentPlaybackTime * 1000,
      durationMs,
      currentTrackId: item?.id ?? null,
      currentPlaybackRef: item
        ? { provider: 'apple-music', ref: item.attributes.playParams?.catalogId ?? item.id }
        : null,
    };
  }

  private notifyListeners(instance: MKInstance): void {
    const state = this.mapState(instance);
    for (const listener of this.listeners) {
      listener(state);
    }
    this.lastTimeNotify = Date.now();
  }

  private notifyListenersThrottled(instance: MKInstance): void {
    const now = Date.now();
    if (now - this.lastTimeNotify < TIME_UPDATE_THROTTLE_MS) return;
    this.notifyListeners(instance);
  }
}
