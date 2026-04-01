import { spotifyAuth } from './spotify';
import { logSpotify } from '@/lib/debugLog';

// HMR-safe storage for player state
interface HMRPlayerState {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  isReady: boolean;
}

// Use Vite's HMR data API to preserve state across hot reloads
const getHMRState = (): HMRPlayerState => {
  if (import.meta.hot?.data.playerState) {
    logSpotify('restoring player state from HMR');
    return import.meta.hot.data.playerState;
  }
  return {
    player: null,
    deviceId: null,
    isReady: false
  };
};

const saveHMRState = (state: HMRPlayerState) => {
  if (import.meta.hot) {
    import.meta.hot.data.playerState = state;
  }
};

class SpotifyPlayerService {
  private player: SpotifyPlayer | null;
  private deviceId: string | null;
  private isReady: boolean;
  private stateChangeCallbacks = new Set<(state: SpotifyPlaybackState | null) => void>();
  private masterListenerAttached = false;
  private pendingSDKLoad: Promise<void> | null = null;
  lastPlayTrackTime = 0;
  /** Timestamp of last confirmed device-active check. */
  private lastDeviceActiveAt = 0;
  /** Timestamp of last successful playback transfer. */
  private lastTransferAt = 0;

  constructor() {
    // Restore state from HMR if available
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

  /**
   * Dynamically load the Spotify Web Playback SDK script.
   * Resolves once the SDK is ready (window.Spotify is available).
   */
  private loadSDK(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Window object not available'));
    }

    // Already loaded
    if (window.Spotify) {
      return Promise.resolve();
    }

    // Deduplicate concurrent calls — reuse the pending promise
    if (this.pendingSDKLoad) {
      return this.pendingSDKLoad;
    }

    this.pendingSDKLoad = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingSDKLoad = null;
        reject(new Error('Spotify SDK failed to load within timeout'));
      }, 10000);

      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
        this.pendingSDKLoad = null;
        resolve();
      };

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () => {
        clearTimeout(timeout);
        this.pendingSDKLoad = null;
        reject(new Error('Failed to load Spotify SDK script'));
      };
      document.body.appendChild(script);
    });

    return this.pendingSDKLoad;
  }

  async initialize(): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('User must be authenticated before initializing player');
    }

    if (this.player) {
      return;
    }

    await this.loadSDK();
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
      volume: 0.5
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

  async playTrack(uri: string, upcomingUris?: string[]): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }
    this.lastPlayTrackTime = Date.now();

    const token = await spotifyAuth.ensureValidToken();

    const uris = upcomingUris?.length ? [uri, ...upcomingUris] : [uri];

    logSpotify('Web API play track deviceId=%s queueSize=%d', this.deviceId, uris.length);

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris, position_ms: 0 }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    logSpotify('Web API play track response status=%d ok=%s', response.status, response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[spotifyPlayer] Spotify API error response:', errorText);
      
      // Try to parse the error as JSON to extract the reason
      let errorReason = '';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.reason) {
          errorReason = ` (${errorJson.error.reason})`;
        }
        if (errorJson.error?.message) {
          errorReason = ` - ${errorJson.error.message}${errorReason}`;
        }
      } catch {
        // If not JSON, use the raw error text
        errorReason = errorText ? ` - ${errorText}` : '';
      }
      
      throw new Error(`Spotify API error: ${response.status}${errorReason}`);
    }
  }

  /**
   * Play a Spotify context (playlist, album, artist) by its URI.
   * This lets Spotify manage the track queue, useful for playlists where
   * the API may not return individual tracks (e.g. Spotify-made playlists).
   */
  async playContext(contextUri: string, offsetPosition?: number): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }
    this.lastPlayTrackTime = Date.now();

    const token = await spotifyAuth.ensureValidToken();

    const body: Record<string, unknown> = { context_uri: contextUri, position_ms: 0 };
    if (offsetPosition !== undefined) {
      body.offset = { position: offsetPosition };
    }

    logSpotify('Web API play context uri=%s offset=%s', contextUri, offsetPosition ?? '(none)');

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[spotifyPlayer] Context playback error:', errorText);

      let errorReason = '';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorReason = ` - ${errorJson.error.message}`;
        }
      } catch {
        errorReason = errorText ? ` - ${errorText}` : '';
      }

      throw new Error(`Spotify API error: ${response.status}${errorReason}`);
    }
  }

  async playPlaylist(uris: string[]): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    logSpotify('Web API play URIs list length=%d deviceId=%s', uris.length, this.deviceId);
    
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris, position_ms: 0 }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    logSpotify('Web API play URIs response status=%d ok=%s', response.status, response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[spotifyPlayer] Spotify API error response:', errorText);
      throw new Error(`Spotify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
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

    // Spotify Web Playback SDK's setVolume() does not work on iOS Safari/Chrome.
    // Use the Web API as a fallback on iOS devices.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && this.deviceId) {
      await this.setVolumeViaWebAPI(Math.round(volume * 100));
      return;
    }

    try {
      await this.player.setVolume(volume);
    } catch {
      // Fallback to Web API if SDK fails (e.g. on other platforms with issues)
      if (this.deviceId) {
        await this.setVolumeViaWebAPI(Math.round(volume * 100));
      }
    }
  }

  /**
   * Set volume via Spotify Web API. Works on iOS where SDK setVolume() fails.
   * @param volumePercent 0-100
   */
  private async setVolumeViaWebAPI(volumePercent: number): Promise<void> {
    if (!this.deviceId) return;

    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const token = await spotifyAuth.ensureValidToken();
    const url = `https://api.spotify.com/v1/me/player/volume?device_id=${this.deviceId}&volume_percent=${clamped}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok && response.status !== 204) {
      console.warn('[spotifyPlayer] Web API setVolume failed:', response.status);
    }
  }

  async getCurrentState(): Promise<SpotifyPlaybackState | null> {
    if (this.player) {
      return await this.player.getCurrentState();
    }
    return null;
  }

  /**
   * Register a callback for player state changes.
   * Multiple callbacks are supported — all registered callbacks are invoked.
   * Returns an unsubscribe function to remove the listener.
   */
  onPlayerStateChanged(callback: (state: SpotifyPlaybackState | null) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    this.syncPlayerStateListener();

    return () => {
      this.stateChangeCallbacks.delete(callback);
      // If no more callbacks, remove the SDK listener to avoid overhead
      if (this.stateChangeCallbacks.size === 0 && this.player) {
        this.player.removeListener('player_state_changed');
        this.masterListenerAttached = false;
      }
    };
  }

  /**
   * Attach a single master SDK listener that fans out to all registered callbacks.
   */
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

  async transferPlaybackToDevice(force = false): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Device not ready for playback transfer');
    }

    if (!force && Date.now() - this.lastTransferAt < SpotifyPlayerService.TRANSFER_TTL_MS) {
      logSpotify('skipping transfer — device recently transferred');
      return;
    }

    const token = await spotifyAuth.ensureValidToken();
    const body = JSON.stringify({ device_ids: [this.deviceId], play: false });
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers,
          body,
        });

        if (!response.ok && response.status !== 204) {
          const errorText = await response.text();
          console.warn('[spotifyPlayer] Transfer playback response:', response.status, errorText);
        } else {
          logSpotify('transferred playback to device');
          this.lastTransferAt = Date.now();
        }
        return;
      } catch (error) {
        if (attempt === 0) {
          console.warn('[spotifyPlayer] Transfer playback network error, retrying:', error);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error('[spotifyPlayer] Failed to transfer playback to device:', error);
          throw error;
        }
      }
    }
  }

  /** How long a successful device-active check remains valid. */
  private static readonly DEVICE_ACTIVE_TTL_MS = 30_000;
  /** How long a successful playback transfer remains valid. */
  private static readonly TRANSFER_TTL_MS = 30_000;

  async ensureDeviceIsActive(maxRetries = 5, initialDelayMs = 800): Promise<boolean> {
    // Skip the API call if device was recently confirmed active
    if (this.isReady && Date.now() - this.lastDeviceActiveAt < SpotifyPlayerService.DEVICE_ACTIVE_TTL_MS) {
      return true;
    }

    const token = await spotifyAuth.ensureValidToken();

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 200) {
          const data = await response.json();
          if (data.device?.id === this.deviceId && data.device?.is_active) {
            logSpotify('device is active and ready');
            this.lastDeviceActiveAt = Date.now();
            return true;
          }
        } else if (response.status === 204) {
          // No active devices yet, continue polling
          logSpotify('no active device yet, attempt %d/%d', i + 1, maxRetries);
        }

        if (i < maxRetries - 1) {
          // Exponential backoff: 800ms, 1600ms, 3200ms, ...
          const delay = initialDelayMs * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`[spotifyPlayer] Error checking device status (attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.warn('[spotifyPlayer] Device not confirmed active after polling, proceeding anyway');
    return false;
  }

  /**
   * Wait for the SDK to report a state change after playTrack(), then
   * resume if the SDK ended up paused at position 0 (a known SDK quirk).
   * Falls back to device activation if no SDK state is available.
   * Times out after `timeoutMs` to avoid hanging indefinitely.
   */
  waitForPlaybackOrResume(activateDevice: () => Promise<void>, timeoutMs = 3000): void {
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
        // else: track is already playing, nothing to do
      } else {
        await activateDevice();
      }
    };

    unsub = this.onPlayerStateChanged((state) => {
      void onStateChange(state);
    });

    // Fallback: if the SDK never fires a state change, check manually
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