import { spotifyAuth } from './spotify';
import { logSpotify } from '@/lib/debugLog';
import {
  SPOTIFY_MAX_RETRIES,
  SPOTIFY_INITIAL_RETRY_DELAY_MS,
  SPOTIFY_INITIAL_VOLUME,
  SPOTIFY_RESUME_TIMEOUT_MS,
} from '@/constants/spotify';
import { getHMRState, saveHMRState, loadSpotifySDK } from './spotifyPlayerSdk';
import {
  apiPlayTrack,
  apiPlayContext,
  apiPlayPlaylist,
  apiSetVolume,
  apiTransferPlayback,
  apiEnsureDeviceActive,
} from './spotifyPlayerPlayback';

const VOLUME_DEBOUNCE_MS = 200;

class SpotifyPlayerService {
  private player: SpotifyPlayer | null;
  private deviceId: string | null;
  private isReady: boolean;
  private stateChangeCallbacks = new Set<(state: SpotifyPlaybackState | null) => void>();
  private masterListenerAttached = false;
  private pendingSDKLoad: { current: Promise<void> | null } = { current: null };
  lastPlayTrackTime = 0;
  private lastDeviceActiveAt = 0;
  private lastTransferAt = 0;
  private volumeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVolumePercent: number | null = null;

  constructor() {
    const hmrState = getHMRState();
    this.player = hmrState.player;
    this.deviceId = hmrState.deviceId;
    this.isReady = hmrState.isReady;

    if (this.isReady) {
      logSpotify('player already ready, device ID: %s', this.deviceId);
    }
  }

  private saveState() {
    saveHMRState({
      player: this.player,
      deviceId: this.deviceId,
      isReady: this.isReady
    });
  }

  async initialize(): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('User must be authenticated before initializing player');
    }

    if (this.player) {
      return;
    }

    await loadSpotifySDK(this.pendingSDKLoad);
    this.setupPlayer();
  }

  private setupPlayer(): void {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('No Spotify access token available');
    }

    this.player = new window.Spotify.Player({
      name: 'Vorbis Player',
      getOAuthToken: (cb) => {
        spotifyAuth.ensureValidToken().then(cb).catch(() => {
          spotifyAuth.redirectToAuth();
        });
      },
      volume: SPOTIFY_INITIAL_VOLUME
    });

    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      logSpotify('player ready with device ID: %s', device_id);
      this.deviceId = device_id;
      this.isReady = true;
      this.saveState();
    });

    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      logSpotify('device ID went offline: %s', device_id);
      this.isReady = false;
      this.saveState();
    });

    this.player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Failed to initialize', message);
    });

    this.player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Failed to authenticate', message);
      spotifyAuth.redirectToAuth();
    });

    this.player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Failed to validate Spotify account', message);
    });

    this.player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Failed to perform playback', message);
    });

    this.player.connect();
    this.saveState();
  }

  async playTrack(uri: string, upcomingUris?: string[], positionMs?: number): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }
    this.lastPlayTrackTime = Date.now();
    await apiPlayTrack(this.deviceId, uri, upcomingUris, positionMs);
  }

  async playContext(contextUri: string, offsetPosition?: number): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }
    this.lastPlayTrackTime = Date.now();
    await apiPlayContext(this.deviceId, contextUri, offsetPosition);
  }

  async playPlaylist(uris: string[]): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }
    await apiPlayPlaylist(this.deviceId, uris);
  }

  async pause(): Promise<void> {
    if (this.player) {
      await this.player.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.player) {
      await this.player.resume();
    }
  }

  async nextTrack(): Promise<void> {
    if (this.player) {
      await this.player.nextTrack();
    }
  }

  async previousTrack(): Promise<void> {
    if (this.player) {
      await this.player.previousTrack();
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (!this.player) return;

    if (!this.isReady || !this.deviceId) {
      return;
    }

    const volumePercent = Math.round(volume * 100);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!isIOS) {
      try {
        await this.player.setVolume(volume);
      } catch {
        // SDK setVolume failed; fall through to debounced API call
      }
    }

    this.pendingVolumePercent = volumePercent;
    if (this.volumeDebounceTimer !== null) {
      clearTimeout(this.volumeDebounceTimer);
    }
    this.volumeDebounceTimer = setTimeout(() => {
      this.volumeDebounceTimer = null;
      const pending = this.pendingVolumePercent;
      this.pendingVolumePercent = null;
      if (pending !== null && this.deviceId && this.isReady) {
        apiSetVolume(this.deviceId, pending).catch(() => {});
      }
    }, VOLUME_DEBOUNCE_MS);
  }

  async getCurrentState(): Promise<SpotifyPlaybackState | null> {
    if (this.player) {
      return await this.player.getCurrentState();
    }
    return null;
  }

  onPlayerStateChanged(callback: (state: SpotifyPlaybackState | null) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    this.syncPlayerStateListener();

    return () => {
      this.stateChangeCallbacks.delete(callback);
      if (this.stateChangeCallbacks.size === 0 && this.player) {
        this.player.removeListener('player_state_changed');
        this.masterListenerAttached = false;
      }
    };
  }

  private syncPlayerStateListener(): void {
    if (this.masterListenerAttached || !this.player) return;
    this.player.removeListener('player_state_changed');
    this.player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
      for (const cb of this.stateChangeCallbacks) {
        try {
          cb(state);
        } catch (err) {
          console.error('[spotifyPlayer] state change callback error:', err);
        }
      }
    });
    this.masterListenerAttached = true;
  }

  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.isReady = false;
      this.lastTransferAt = 0;
      this.saveState();
    }
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  private static readonly DEVICE_ACTIVE_TTL_MS = 300_000;
  private static readonly TRANSFER_TTL_MS = 300_000;

  async transferPlaybackToDevice(force = false): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Device not ready for playback transfer');
    }

    if (!force && Date.now() - this.lastTransferAt < SpotifyPlayerService.TRANSFER_TTL_MS) {
      logSpotify('skipping transfer -- device recently transferred');
      return;
    }

    const token = await spotifyAuth.ensureValidToken();
    const success = await apiTransferPlayback(this.deviceId, token);
    if (success) {
      this.lastTransferAt = Date.now();
    }
  }

  async ensureDeviceIsActive(maxRetries = SPOTIFY_MAX_RETRIES, initialDelayMs = SPOTIFY_INITIAL_RETRY_DELAY_MS): Promise<boolean> {
    if (this.isReady && Date.now() - this.lastDeviceActiveAt < SpotifyPlayerService.DEVICE_ACTIVE_TTL_MS) {
      return true;
    }

    const token = await spotifyAuth.ensureValidToken();
    const active = await apiEnsureDeviceActive(this.deviceId!, token, maxRetries, initialDelayMs);
    if (active) {
      this.lastDeviceActiveAt = Date.now();
    }
    return active;
  }

  waitForPlaybackOrResume(activateDevice: () => Promise<void>, timeoutMs = SPOTIFY_RESUME_TIMEOUT_MS): void {
    let settled = false;
    let unsub: (() => void) | null = null;

    const cleanup = () => {
      if (unsub) { unsub(); unsub = null; }
    };

    const onStateChange = async (state: SpotifyPlaybackState | null) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (state) {
        if (state.paused && state.position === 0) {
          try { await this.resume(); } catch { /* ignore */ }
        }
      } else {
        await activateDevice();
      }
    };

    unsub = this.onPlayerStateChanged((state) => {
      void onStateChange(state);
    });

    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      void (async () => {
        const state = await this.getCurrentState();
        if (state) {
          if (state.paused && state.position === 0) {
            try { await this.resume(); } catch { /* ignore */ }
          }
        } else {
          await activateDevice();
        }
      })();
    }, timeoutMs);
  }
}

export const spotifyPlayer = new SpotifyPlayerService();
