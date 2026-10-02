import type { AddToQueueResult, CollectionSelection, MediaTrack } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';

/** Props for LibraryRoute mounts from AudioPlayer (mini-player actions use PlaybackActionsContext). */
export interface LibraryRouteSharedProps {
  onSelectCollection: (selection: CollectionSelection) => void;
  onAddToQueue: (selection: CollectionSelection) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks: (
    tracks: MediaTrack[],
    selection: CollectionSelection,
  ) => Promise<void>;
  onQueueLikedTracks: (tracks: MediaTrack[], collectionName?: string) => void;
  onResume: () => void;
  lastSession: SessionSnapshot | null;
  onPlayNext: (selection: CollectionSelection) => void;
  initialSearchQuery?: string | undefined;
  isPlaying: boolean;
  isRadioAvailable: boolean | undefined;
  isRadioGenerating: boolean | undefined;
  onClose: () => void;
}
