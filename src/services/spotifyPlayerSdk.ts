import { logSpotify } from '@/lib/debugLog';

interface HMRPlayerState {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  isReady: boolean;
}

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

export { getHMRState, saveHMRState };

export function loadSpotifySDK(pendingRef: { current: Promise<void> | null }): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window object not available'));
  }

  if (window.Spotify) {
    return Promise.resolve();
  }

  if (pendingRef.current) {
    return pendingRef.current;
  }

  pendingRef.current = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRef.current = null;
      reject(new Error('Spotify SDK failed to load within timeout'));
    }, 10000);

    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timeout);
      pendingRef.current = null;
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      pendingRef.current = null;
      reject(new Error('Failed to load Spotify SDK script'));
    };
    document.body.appendChild(script);
  });

  return pendingRef.current;
}
