import { useCallback } from 'react';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack } from '@/types/domain';
import type { Track } from '../services/spotify';

interface UsePlaybackProps {
  tracks: Track[];
  setCurrentTrackIndex: (index: number) => void;
  activeDescriptor?: ProviderDescriptor | null;
  mediaTracksRef?: React.MutableRefObject<MediaTrack[]>;
}

/**
 * Provider-agnostic playback hook.
 * Routes all playback through `activeDescriptor.playback.playTrack()`.
 * Provider-specific retry/recovery logic lives in the adapters themselves.
 */
export const usePlayback = ({
  tracks,
  setCurrentTrackIndex,
  activeDescriptor,
  mediaTracksRef,
}: UsePlaybackProps) => {

  const playTrack = useCallback(async (index: number, skipOnError = false) => {
    const playback = activeDescriptor?.playback;
    if (!playback) return;

    // Resolve the MediaTrack for this index
    const mediaTracks = mediaTracksRef?.current ?? [];
    const mediaTrack = mediaTracks[index];

    // Validate that we have a track at this index
    if (!mediaTrack && !tracks[index]) {
      console.error('[usePlayback] No track at index', index);
      return;
    }

    // Build a MediaTrack from the Track if mediaTracksRef isn't populated
    // (e.g. during Spotify-only usage where mediaTracksRef may be sparse)
    const trackToPlay: MediaTrack | null = mediaTrack ?? (tracks[index] ? {
      id: tracks[index].id,
      provider: activeDescriptor.id,
      playbackRef: { provider: activeDescriptor.id, ref: tracks[index].uri },
      name: tracks[index].name,
      artists: tracks[index].artists,
      album: tracks[index].album,
      albumId: tracks[index].album_id,
      trackNumber: tracks[index].track_number,
      durationMs: tracks[index].duration_ms,
      image: tracks[index].image,
    } : null);

    if (!trackToPlay) return;

    const totalTracks = mediaTracks.length || tracks.length;

    try {
      await playback.playTrack(trackToPlay);
      setCurrentTrackIndex(index);
    } catch (error) {
      console.error(`[usePlayback] Failed to play track:`, error);
      if (skipOnError && index < totalTracks - 1) {
        setTimeout(() => playTrack(index + 1, skipOnError), 500);
      }
    }
  }, [tracks, setCurrentTrackIndex, activeDescriptor, mediaTracksRef]);

  const resumePlayback = useCallback(async () => {
    try {
      await activeDescriptor?.playback?.resume();
    } catch (error) {
      console.error('[usePlayback] Failed to resume playback:', error);
    }
  }, [activeDescriptor]);

  return {
    playTrack,
    resumePlayback,
  };
};
