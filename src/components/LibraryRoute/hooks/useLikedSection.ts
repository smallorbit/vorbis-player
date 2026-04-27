import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import type { LikedSummary } from '../types';

export function useLikedSection(): LikedSummary {
  const {
    isUnifiedLikedActive,
    totalCount: unifiedCount,
    isLoading: unifiedLoading,
  } = useUnifiedLikedTracks();
  const { likedSongsCount, likedSongsPerProvider, isLikedSongsSyncing } = useLibrarySync();

  return {
    totalCount: isUnifiedLikedActive ? unifiedCount : likedSongsCount,
    perProvider: likedSongsPerProvider,
    isUnified: isUnifiedLikedActive,
    isLoading: isUnifiedLikedActive ? unifiedLoading : isLikedSongsSyncing,
  };
}
