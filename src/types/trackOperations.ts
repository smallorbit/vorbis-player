import type { MediaTrack, PlaybackSelection } from './domain';

export interface TrackOperations {
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setSelection: (selection: PlaybackSelection | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
}
