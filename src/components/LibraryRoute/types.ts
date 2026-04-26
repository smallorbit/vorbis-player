import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';
import type { SessionSnapshot } from '@/services/sessionPersistence';

export interface SectionState<T> {
  items: T[];
  isLoading: boolean;
  isEmpty: boolean;
}

export interface LikedSummary {
  totalCount: number;
  perProvider: Array<{ provider: ProviderId; count: number }>;
  isUnified: boolean;
  isLoading: boolean;
}

export type {
  CachedPlaylistInfo,
  AlbumInfo,
  MediaTrack,
  ProviderId,
  RecentlyPlayedEntry,
  SessionSnapshot,
};
