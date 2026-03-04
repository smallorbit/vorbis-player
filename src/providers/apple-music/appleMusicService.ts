/**
 * Apple Music service — lazy SDK loading, configuration, and singleton access.
 * Pattern follows src/services/spotifyPlayer.ts.
 */

import type { MKInstance, MusicKitGlobal } from './appleMusicTypes';

const SDK_URL = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
const SDK_TIMEOUT_MS = 15_000;
const TOKEN_STORAGE_KEY = 'vorbis-player-apple-music-token';

/** HMR-safe storage for the MusicKit instance. */
interface HMRState {
  instance: MKInstance | null;
}

const getHMRState = (): HMRState => {
  if (import.meta.hot?.data?.appleMusicState) {
    return import.meta.hot.data.appleMusicState;
  }
  return { instance: null };
};

const saveHMRState = (state: HMRState) => {
  if (import.meta.hot?.data) {
    import.meta.hot.data.appleMusicState = state;
  }
};

class AppleMusicService {
  private instance: MKInstance | null;
  private loadPromise: Promise<MKInstance> | null = null;

  constructor() {
    const hmr = getHMRState();
    this.instance = hmr.instance;
  }

  /**
   * Load the MusicKit JS SDK (if needed), configure it, and return the instance.
   * Concurrent calls are deduplicated.
   */
  async ensureLoaded(): Promise<MKInstance> {
    if (this.instance) return this.instance;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadAndConfigure().finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  getInstance(): MKInstance | null {
    return this.instance;
  }

  isAuthorized(): boolean {
    return this.instance?.isAuthorized ?? !!localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  /** Persist the user token so `isAuthorized` works before SDK loads. */
  persistToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  private async loadAndConfigure(): Promise<MKInstance> {
    await this.injectSDK();

    const mk = window.MusicKit as MusicKitGlobal;
    const developerToken = import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('VITE_APPLE_MUSIC_DEVELOPER_TOKEN is not set');
    }

    const instance = await mk.configure({
      developerToken,
      app: { name: 'Vorbis Player', build: '1.0.0' },
    });

    this.instance = instance;
    saveHMRState({ instance });
    return instance;
  }

  private injectSDK(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Window object not available'));
    }
    if (window.MusicKit) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MusicKit JS SDK failed to load within timeout'));
      }, SDK_TIMEOUT_MS);

      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.MusicKit) {
          resolve();
        } else {
          // MusicKit may use musickitloaded event
          document.addEventListener(
            'musickitloaded',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        }
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load MusicKit JS SDK script'));
      };
      document.head.appendChild(script);
    });
  }
}

export const appleMusicService = new AppleMusicService();
