import type { MediaTrack } from '@/types/domain';

/** Shared contract for desktop drawer + mobile bottom sheet (F12). */
export interface QueueSurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: MediaTrack[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onRemoveTrack?: ((index: number) => void) | undefined;
  onReorderTracks?: ((fromIndex: number, toIndex: number) => void) | undefined;
  showProviderIcons?: boolean | undefined;
  radioActive?: boolean | undefined;
  radioSeedDescription?: string | undefined;
  onSaveQueue?: (() => void) | undefined;
  canSaveQueue?: boolean | undefined;
}

/** Detect reorder / id changes when length and current index are unchanged (memo guard). */
function queueTrackOrderKey(tracks: { id: string }[]): string {
  return tracks.map((t) => t.id).join('|');
}

export function areQueueSurfacePropsEqual(
  prev: QueueSurfaceProps,
  next: QueueSurfaceProps,
): boolean {
  if (prev.isOpen !== next.isOpen) return false;
  if (prev.currentTrackIndex !== next.currentTrackIndex) return false;
  if (prev.tracks.length !== next.tracks.length) return false;
  if (queueTrackOrderKey(prev.tracks) !== queueTrackOrderKey(next.tracks)) return false;
  if (prev.radioActive !== next.radioActive) return false;
  if (prev.radioSeedDescription !== next.radioSeedDescription) return false;
  if (prev.canSaveQueue !== next.canSaveQueue) return false;
  return true;
}
