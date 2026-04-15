import { useMemo, useState } from 'react';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';

interface UseLibraryStatusParams {
  activeDescriptor: ProviderDescriptor | null | undefined;
  enabledProviderIds: ProviderId[];
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined;
  playlistsCount: number;
  albumsCount: number;
  likedSongsCount: number;
  isInitialLoadComplete: boolean;
}

export interface LibraryStatusResult {
  isAuthenticated: boolean;
  error: string | null;
  showMainContent: boolean;
  statusContentProps: {
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    activeDescriptor: ProviderDescriptor | null;
    setError: (value: string | null) => void;
  };
}

export function useLibraryStatus({
  activeDescriptor,
  enabledProviderIds,
  getDescriptor,
  playlistsCount,
  albumsCount,
  likedSongsCount,
  isInitialLoadComplete,
}: UseLibraryStatusParams): LibraryStatusResult {
  const [loginError, setLoginError] = useState<string | null>(null);

  const isAuthenticated = useMemo(
    () =>
      enabledProviderIds.some(id => getDescriptor(id)?.auth.isAuthenticated()) ||
      (activeDescriptor?.auth.isAuthenticated() ?? false),
    [activeDescriptor, enabledProviderIds, getDescriptor]
  );

  const libraryError = useMemo(() => {
    if (!isInitialLoadComplete) return null;
    if (playlistsCount === 0 && albumsCount === 0 && likedSongsCount === 0) {
      const providerName = activeDescriptor?.name ?? 'your music service';
      return `No playlists, albums, or liked songs found. Please add some music to ${providerName} first.`;
    }
    return null;
  }, [isInitialLoadComplete, playlistsCount, albumsCount, likedSongsCount, activeDescriptor]);

  const error = loginError ?? libraryError;

  const isLoading = false;
  const hasAnyContent = playlistsCount > 0 || albumsCount > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !isInitialLoadComplete));

  const statusContentProps = {
    isLoading,
    isAuthenticated,
    error,
    activeDescriptor: activeDescriptor ?? null,
    setError: setLoginError,
  };

  return {
    isAuthenticated,
    error,
    showMainContent,
    statusContentProps,
  };
}
