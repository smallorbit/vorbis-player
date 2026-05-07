import type { PlaybackProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, PlaybackState, CollectionRef } from '@/types/domain';
import { clipUrlForTrack } from './audioMapping';

const POSITION_UPDATE_INTERVAL_MS = 100;

export class MockPlaybackAdapter implements PlaybackProvider {
  readonly providerId: ProviderId;

  private audio: HTMLAudioElement | null = null;
  private currentTrack: MediaTrack | null = null;
  private listeners = new Set<(state: PlaybackState | null) => void>();
  private positionTimer: ReturnType<typeof setInterval> | null = null;
  private startedAtMs = 0;
  private startedAtPositionMs = 0;
  private pendingError: PlaybackState['playbackError'] | undefined = undefined;
  private lastPlayTimeMs = 0;

  constructor(providerId: ProviderId) {
    this.providerId = providerId;
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.loop = true;

    this.audio.addEventListener('play', () => this.notifyListeners());
    this.audio.addEventListener('pause', () => this.notifyListeners());
    this.audio.addEventListener('error', () => {
      const err = this.audio?.error;
      this.pendingError = {
        code: err?.code ?? 0,
        message: err?.message || `MediaError code ${err?.code ?? 0}`,
      };
      console.error('[MockPlayback] Audio error:', err);
      this.notifyListeners();
    });

    return this.audio;
  }

  private startPositionTimer(): void {
    if (this.positionTimer !== null) return;
    this.positionTimer = setInterval(() => this.notifyListeners(), POSITION_UPDATE_INTERVAL_MS);
  }

  private stopPositionTimer(): void {
    if (this.positionTimer !== null) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }

  private getSynthesizedPositionMs(): number {
    if (!this.currentTrack) return 0;
    if (!this.audio || this.audio.paused) return this.startedAtPositionMs;
    const elapsed = Date.now() - this.startedAtMs;
    const position = this.startedAtPositionMs + elapsed;
    return Math.min(position, this.currentTrack.durationMs);
  }

  private notifyListeners(): void {
    const state = this.buildState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private buildState(): PlaybackState | null {
    if (!this.currentTrack) return null;
    const state: PlaybackState = {
      isPlaying: this.audio ? !this.audio.paused : false,
      positionMs: this.getSynthesizedPositionMs(),
      durationMs: this.currentTrack.durationMs,
      currentTrackId: this.currentTrack.id,
      currentPlaybackRef: this.currentTrack.playbackRef,
    };
    if (this.pendingError) {
      state.playbackError = this.pendingError;
      this.pendingError = undefined;
    }
    return state;
  }

  async initialize(): Promise<void> {
    this.ensureAudio();
  }

  async playTrack(track: MediaTrack, options?: { positionMs?: number }): Promise<void> {
    const audio = this.ensureAudio();
    this.currentTrack = track;
    this.lastPlayTimeMs = Date.now();

    const clipUrl = clipUrlForTrack(track.id);
    audio.src = clipUrl;
    audio.load();

    const startPositionMs = options?.positionMs ?? 0;
    this.startedAtPositionMs = startPositionMs;
    this.startedAtMs = Date.now();

    try {
      await audio.play();
    } catch (err) {
      console.warn('[MockPlayback] play() rejected:', err);
    }

    this.startPositionTimer();
    this.notifyListeners();
  }

  async playCollection(collectionRef: CollectionRef): Promise<void> {
    void collectionRef;
    // Collection playback is driven by the app's queue
  }

  async pause(): Promise<void> {
    if (!this.audio || this.audio.paused) return;
    this.startedAtPositionMs = this.getSynthesizedPositionMs();
    this.audio.pause();
    this.stopPositionTimer();
    this.notifyListeners();
  }

  async resume(): Promise<void> {
    if (!this.audio || !this.audio.paused) return;
    this.startedAtMs = Date.now();
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('[MockPlayback] resume play() rejected:', err);
    }
    this.startPositionTimer();
    this.notifyListeners();
  }

  async seek(positionMs: number): Promise<void> {
    if (!this.currentTrack) return;
    this.startedAtPositionMs = positionMs;
    this.startedAtMs = Date.now();
    this.notifyListeners();
  }

  async next(): Promise<void> {
    throw new Error('[MockPlayback] next() is managed by the app queue, not the adapter');
  }

  async previous(): Promise<void> {
    throw new Error('[MockPlayback] previous() is managed by the app queue, not the adapter');
  }

  async setVolume(volume0to1: number): Promise<void> {
    const audio = this.ensureAudio();
    audio.volume = Math.max(0, Math.min(1, volume0to1));
  }

  async getState(): Promise<PlaybackState | null> {
    return this.buildState();
  }

  subscribe(listener: (state: PlaybackState | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  prepareTrack(track: MediaTrack, options?: { positionMs?: number }): void {
    const audio = this.ensureAudio();
    audio.src = clipUrlForTrack(track.id);
    audio.load();

    if (options?.positionMs !== undefined) {
      this.currentTrack = track;
      this.startedAtPositionMs = options.positionMs;
      this.startedAtMs = Date.now();
      this.notifyListeners();
    }
  }

  probePlayable(track: MediaTrack): Promise<boolean> {
    void track;
    return Promise.resolve(true);
  }

  getLastPlayTime(): number {
    return this.lastPlayTimeMs;
  }
}
