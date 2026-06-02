import type { CollectionRef, ProviderId } from '@/types/domain';

export interface UseCollectionSectionParams {
  providerFilter?: ProviderId[];
  excludePinned?: boolean;
}

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
  | 'search';

/** Kinds a library card represents directly (no meta-wrappers). */
export type LibraryCollectionKind = 'playlist' | 'album' | 'liked';

export type LibraryItemKind = LibraryCollectionKind | 'recently-played';

interface ContextMenuRequestBase {
  id: string;
  provider?: ProviderId | undefined;
  name: string;
  anchorRect: DOMRect;
  /** The CardButton element that triggered the menu; used to return focus on keyboard dismiss. */
  triggerElement?: HTMLElement | undefined;
}

export type ContextMenuRequest = ContextMenuRequestBase &
  (
    | { kind: 'playlist' }
    | { kind: 'album' }
    | { kind: 'liked' }
    | {
        kind: 'recently-played';
        /** Underlying collection kind so the menu can dispatch the right schema. */
        originalKind: 'playlist' | 'album' | 'liked';
        /** Back-pointer used by the "Remove from history" action. */
        recentRef: CollectionRef;
      }
  );

export type { ProviderId };
