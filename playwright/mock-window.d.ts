export {};

declare global {
  interface Window {
    __mockTest?: {
      setQueue(trackIds: string[]): Promise<void>;
      setPlaybackState(state: {
        trackId: string;
        positionMs?: number;
        isPlaying?: boolean;
      }): Promise<void>;
      expireAuth(
        providerId: 'spotify' | 'dropbox',
        opts?: { alsoDispatchSessionExpired?: boolean },
      ): Promise<void>;
      restoreAuth(providerId: 'spotify' | 'dropbox'): Promise<void>;
      isAuthenticated(providerId: 'spotify' | 'dropbox'): boolean;
      reset(): Promise<void>;
      triggerNaturalEnd(providerId: 'spotify' | 'dropbox'): Promise<void>;
      getPlaybackState(
        providerId: 'spotify' | 'dropbox',
      ): Promise<{ isPlaying: boolean; trackId: string | null }>;
    };
  }
}
