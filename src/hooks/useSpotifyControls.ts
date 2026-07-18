import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import type { PlaybackState, ProviderId } from '@/types/domain';
import { logSeek } from '@/lib/debugLog';

// After a seek, the SDK can still emit a stale pre-seek position (notably after
// a re-auth re-subscribe / getState), which would yank the timeline cursor back
// and "disconnect" it from playback (#1671). Until a position emit lands near the
// seek target, reject stale ones. Tolerance absorbs normal play drift between
// emits; the window is a safety valve so the cursor can never get stuck if the
// SDK never reports near the target.
const SEEK_TOLERANCE_MS = 2000;
const SEEK_GUARD_WINDOW_MS = 5000;

interface UseSpotifyControlsProps {
  currentTrack: MediaTrack | null;
  isLiked: boolean;
  isLikePending: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onLikeToggle: () => void;
  currentTrackProvider?: ProviderId | undefined;
}

interface PlaybackTimingState {
  isPlaying: boolean;
  currentPosition: number;
  duration: number;
}

type PlaybackTimingAction =
  | { type: 'update'; isPlaying: boolean; positionMs: number; durationMs?: number }
  | { type: 'update_no_position'; isPlaying: boolean; durationMs?: number }
  | { type: 'position'; positionMs: number };

function playbackTimingReducer(state: PlaybackTimingState, action: PlaybackTimingAction): PlaybackTimingState {
  switch (action.type) {
    case 'update':
      return {
        isPlaying: action.isPlaying,
        currentPosition: action.positionMs,
        duration: action.durationMs ?? state.duration,
      };
    case 'update_no_position':
      return {
        ...state,
        isPlaying: action.isPlaying,
        duration: action.durationMs ?? state.duration,
      };
    case 'position':
      return { ...state, currentPosition: action.positionMs };
  }
}

export const useSpotifyControls = ({
  currentTrack,
  isLiked,
  isLikePending,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onLikeToggle,
  currentTrackProvider,
}: UseSpotifyControlsProps) => {
  const [{ isPlaying, currentPosition, duration }, dispatchTiming] = useReducer(
    playbackTimingReducer,
    { isPlaying: false, currentPosition: 0, duration: 0 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  // Set when a seek is issued; cleared once a position emit is accepted near the
  // target (or the guard window lapses). See SEEK_* constants above.
  const pendingSeekRef = useRef<{ target: number; at: number } | null>(null);

  const { activeDescriptor } = useProviderContext();

  // Decide whether an incoming position emit should move the cursor. Returns
  // true (accept) when no seek is pending, when the emit is near the expected
  // post-seek position, or when the guard window has lapsed; false (reject) for a
  // stale pre-seek position. Reads/writes refs only, so it is stable and does not
  // re-subscribe the playback listeners.
  const shouldAcceptPosition = useCallback((positionMs: number, playing: boolean): boolean => {
    const pending = pendingSeekRef.current;
    if (!pending) return true;

    const elapsed = performance.now() - pending.at;
    if (elapsed > SEEK_GUARD_WINDOW_MS) {
      pendingSeekRef.current = null;
      logSeek('guard window lapsed → accept (pos=%dms)', Math.round(positionMs));
      return true;
    }

    const expected = pending.target + (playing ? elapsed : 0);
    const drift = Math.abs(positionMs - expected);
    if (drift <= SEEK_TOLERANCE_MS) {
      pendingSeekRef.current = null;
      logSeek('post-seek confirmed → accept (pos=%dms, expected=%dms, drift=%dms)',
        Math.round(positionMs), Math.round(expected), Math.round(drift));
      return true;
    }

    logSeek('REJECT stale position (pos=%dms, expected=%dms, drift=%dms, target=%dms)',
      Math.round(positionMs), Math.round(expected), Math.round(drift), Math.round(pending.target));
    return false;
  }, []);

  // Drop the guard on track change — a new track starts at 0, unrelated to any
  // pending seek on the previous one.
  useEffect(() => {
    pendingSeekRef.current = null;
  }, [currentTrack?.id]);

  const getPlayingDescriptor = useCallback(() =>
    currentTrackProvider && currentTrackProvider !== activeDescriptor?.id
      ? providerRegistry.get(currentTrackProvider)
      : activeDescriptor,
    [currentTrackProvider, activeDescriptor]
  );

  // Keep ref in sync so the event handler always has the latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Use event-based playback state updates via the provider adapter.
  // In cross-provider mode the active descriptor may be Dropbox while a Spotify track is
  // actually playing, so we subscribe to whichever adapter owns the current track.
  useEffect(() => {
    const playingDescriptor = getPlayingDescriptor();
    const playback = playingDescriptor?.playback;
    if (!playback) return;

    function handleProviderStateChange(state: PlaybackState | null) {
      if (!state) return;
      // While dragging, or when a stale pre-seek position arrives, sync
      // isPlaying/duration but leave the cursor where the user/seek put it.
      if (isDraggingRef.current || !shouldAcceptPosition(state.positionMs, state.isPlaying)) {
        dispatchTiming({ type: 'update_no_position', isPlaying: state.isPlaying, durationMs: state.durationMs });
      } else {
        dispatchTiming({ type: 'update', isPlaying: state.isPlaying, positionMs: state.positionMs, durationMs: state.durationMs });
      }
    }

    const unsubscribe = playback.subscribe(handleProviderStateChange);

    // Also check initial state once
    playback.getState().then((state) => {
      if (state && shouldAcceptPosition(state.positionMs, state.isPlaying)) {
        dispatchTiming({ type: 'update', isPlaying: state.isPlaying, positionMs: state.positionMs, durationMs: state.durationMs });
      }
    });

    return unsubscribe;
  }, [getPlayingDescriptor, shouldAcceptPosition]);

  // Lightweight position poll — only to update the timeline slider smoothly.
  // Poll the adapter that is actually playing, which may differ from the active
  // descriptor in cross-provider queues.
  useEffect(() => {
    if (!isPlaying) return;
    const playingDescriptor = getPlayingDescriptor();
    const playback = playingDescriptor?.playback;
    if (!playback) return;

    const interval = setInterval(async () => {
      if (isDraggingRef.current) return;
      const state = await playback.getState();
      if (state && shouldAcceptPosition(state.positionMs, state.isPlaying)) {
        dispatchTiming({ type: 'position', positionMs: state.positionMs });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, getPlayingDescriptor, shouldAcceptPosition]);

  const handlePlayPause = useCallback(async () => {
    const playingDescriptor = getPlayingDescriptor();
    const playback = playingDescriptor?.playback;
    if (!playback) return;

    if (isPlaying) {
      onPause();
    } else {
      const state = await playback.getState();

      if (!state || !state.currentTrackId ||
          (currentTrack && state.currentTrackId !== currentTrack.id)) {
        onPlay();
      } else {
        if (!state.isPlaying) {
          await playback.resume();
        }
      }
    }
  }, [isPlaying, onPlay, onPause, currentTrack, getPlayingDescriptor]);

  const handleSeek = useCallback(async (position: number) => {
    try {
      const playingDescriptor = getPlayingDescriptor();
      const playback = playingDescriptor?.playback;
      if (!playback) return;
      // Arm the guard and optimistically move the cursor to the target so it
      // reflects the seek immediately and cannot be dragged back by a stale
      // pre-seek emit before the SDK reports the new position (#1671).
      pendingSeekRef.current = { target: position, at: performance.now() };
      logSeek('seek issued → target=%dms (guard armed)', Math.round(position));
      dispatchTiming({ type: 'position', positionMs: position });
      await playback.seek(position);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, [getPlayingDescriptor]);

  const handleSeekDuringScrub = useCallback((position: number) => {
    dispatchTiming({ type: 'position', positionMs: position });
  }, []);

  const handleScrubStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleScrubEnd = useCallback((position: number) => {
    setIsDragging(false);
    handleSeek(position);
  }, [handleSeek]);

  const formatTime = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    isPlaying,
    currentPosition,
    duration,
    isDragging,
    isLiked,
    isLikePending,
    handlePlayPause,
    handleLikeToggle: onLikeToggle,
    handleSeek,
    handleSeekDuringScrub,
    handleScrubStart,
    handleScrubEnd,
    formatTime,
    onNext,
    onPrevious,
  };
};
