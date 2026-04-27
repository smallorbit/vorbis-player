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

export type LibraryRouteView =
  | 'home'
  | 'recently-played'
  | 'pinned'
  | 'playlists'
  | 'albums'
  | 'liked'
  | 'search';

export type LibraryItemKind = 'playlist' | 'album' | 'liked' | 'recently-played';

export interface ContextMenuRequest {
  kind: LibraryItemKind;
  id: string;
  provider?: ProviderId;
  name: string;
  anchorRect: DOMRect;
  /** The CardButton element that triggered the menu; used to return focus on keyboard dismiss. */
  triggerElement?: HTMLElement;
  /** When kind === 'recently-played', the underlying collection kind so the menu can dispatch the right schema. */
  originalKind?: 'playlist' | 'album' | 'liked';
  /** When kind === 'recently-played', back-pointer used by the "Remove from history" action. */
  recentRef?: { kind: 'playlist' | 'album' | 'liked'; id: string; provider?: ProviderId };
}

export type {
  CachedPlaylistInfo,
  AlbumInfo,
  MediaTrack,
  ProviderId,
  RecentlyPlayedEntry,
  SessionSnapshot,
};
