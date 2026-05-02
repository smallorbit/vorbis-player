import type { MediaTrack } from '@/types/domain';

/** Tracks with stable `id` used to align UI order with `MediaTrack[]` playback mirror. */
interface TrackOrderItem {
  id: string;
}

/**
 * Reorders `mediaTracks` to match `tracks` by id. Returns null if lengths differ or any id is missing.
 * Used to keep `mediaTracksRef` aligned with shuffled/reordered UI lists.
 */
export function reorderMediaTracksToMatchTracks(
  tracks: readonly TrackOrderItem[],
  mediaTracks: readonly MediaTrack[],
): MediaTrack[] | null {
  if (mediaTracks.length === 0 || mediaTracks.length !== tracks.length) return null;
  const idToMedia = new Map(mediaTracks.map((m) => [m.id, m]));
  const reordered = tracks.map((t) => idToMedia.get(t.id)).filter((m): m is MediaTrack => m !== undefined);
  return reordered.length === tracks.length ? reordered : null;
}

/** Remove one item by id (queue remove). */
export function removeMediaTrackById(mediaTracks: readonly MediaTrack[], trackId: string): MediaTrack[] {
  return mediaTracks.filter((m) => m.id !== trackId);
}

/** Append for "add to queue" without mutating the source list. */
export function appendMediaTracks(
  mediaTracks: readonly MediaTrack[],
  additions: readonly MediaTrack[],
): MediaTrack[] {
  return [...mediaTracks, ...additions];
}

/**
 * Insert tracks at a given position (used for "play next"). Clamps the index
 * to the valid range [0, mediaTracks.length] without mutating the source list.
 */
export function insertMediaTracksAt(
  mediaTracks: readonly MediaTrack[],
  index: number,
  additions: readonly MediaTrack[],
): MediaTrack[] {
  const clamped = Math.max(0, Math.min(index, mediaTracks.length));
  const result = [...mediaTracks];
  result.splice(clamped, 0, ...additions);
  return result;
}

/** Move one element; returns a new array (immutable). */
export function moveItemInArray<T>(arr: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}
