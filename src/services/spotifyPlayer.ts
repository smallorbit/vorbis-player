import { spotifyAuth } from './spotify';

// Global callback for Spotify SDK ready event
let spotifySDKReadyCallback: (() => void) | null = null;

// Define the global callback that the Spotify SDK will call
if (typeof window !== 'undefined') {
  window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify SDK ready callback triggered');
    if (spotifySDKReadyCallback) {
      spotifySDKReadyCallback();
    }
  };
}

export class SpotifyPlayerService {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private isReady = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) {
      throw new Error('User must be authenticated before initializing player');
    }

    if (this.player) {
      return;
    }

    return new Promise((resolve, reject) => {
      const initPlayer = () => {
        try {
          this.setupPlayer();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      if (typeof window !== 'undefined' && window.Spotify) {
        console.log('Spotify SDK already available, initializing player');
        initPlayer();
      } else if (typeof window !== 'undefined') {
        console.log('Waiting for Spotify SDK to load...');
        // Set the callback that will be called by the global onSpotifyWebPlaybackSDKReady
        spotifySDKReadyCallback = initPlayer;
        
        setTimeout(() => {
          if (!this.player) {
            console.error('Spotify SDK failed to load within timeout');
            spotifySDKReadyCallback = null; // Clear the callback
            reject(new Error('Spotify SDK failed to load within timeout'));
          }
        }, 10000);
      } else {
        reject(new Error('Window object not available'));
      }
    });
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
      console.log('🎵 Spotify player ready with device ID:', device_id);
      this.deviceId = device_id;
      this.isReady = true;
    });

    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id);
      this.isReady = false;
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
  }

  async playTrack(uri: string): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    console.log('🎵 Making Spotify API call to play track:', {
      deviceId: this.deviceId,
      uri: uri,
      hasToken: !!token
    });
    
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris: [uri] }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    console.log('🎵 Spotify API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 Spotify API error response:', errorText);
      throw new Error(`Spotify API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  async playPlaylist(uris: string[]): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Spotify player not ready');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    console.log('🎵 Making Spotify API call to play playlist:', {
      deviceId: this.deviceId,
      tracksCount: uris.length,
      hasToken: !!token
    });
    
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ uris }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    console.log('🎵 Spotify API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 Spotify API error response:', errorText);
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
    if (this.player) {
      await this.player.setVolume(volume);
    }
  }

  async getCurrentState(): Promise<SpotifyPlaybackState | null> {
    if (this.player) {
      return await this.player.getCurrentState();
    }
    return null;
  }

  onPlayerStateChanged(callback: (state: SpotifyPlaybackState | null) => void): void {
    if (this.player) {
      this.player.removeListener('player_state_changed');
      this.player.addListener('player_state_changed', callback);
    }
  }

  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.isReady = false;
    }
    // Clear the global callback
    spotifySDKReadyCallback = null;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  async transferPlaybackToDevice(): Promise<void> {
    if (!this.deviceId || !this.isReady) {
      throw new Error('Device not ready for playback transfer');
    }

    const token = await spotifyAuth.ensureValidToken();
    
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [this.deviceId],
          play: false
        })
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.warn('Transfer playback response:', response.status, errorText);
      } else {
        console.log('🎵 Successfully transferred playback to device');
      }
    } catch (error) {
      console.error('🎵 Failed to transfer playback to device:', error);
      throw error;
    }
  }

  async ensureDeviceIsActive(maxRetries = 10, delayMs = 500): Promise<boolean> {
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
            console.log('🎵 Device is active and ready');
            return true;
          }
        } else if (response.status === 204) {
          // No active devices yet, continue polling
          console.log(`🎵 No active device yet, attempt ${i + 1}/${maxRetries}`);
        }

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.warn(`🎵 Error checking device status (attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.warn('🎵 Device not confirmed active after polling, proceeding anyway');
    return false;
  }
}

export const spotifyPlayer = new SpotifyPlayerService();