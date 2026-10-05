import { useEffect } from 'react';
import type { MediaTrack } from '@/types/domain';
import { playbackStore } from '@/stores/playbackStore';
import { logCaughtError } from '@/utils/logCaughtError';

export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

function getMediaSession(): MediaSession | null {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
}

function setActionHandler(
  session: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
): void {
  try {
    session.setActionHandler(action, handler);
  } catch (err) {
    // Browsers throw for actions they do not support (e.g. `seekto` in older Safari).
    logCaughtError(`useMediaSession.setActionHandler.${action}`, err);
  }
}

function syncPlaybackState(session: MediaSession): void {
  const { isPlaying, positionMs, durationMs } = playbackStore.getSnapshot();
  session.playbackState = isPlaying ? 'playing' : 'paused';
  if (durationMs <= 0 || typeof session.setPositionState !== 'function') return;
  try {
    session.setPositionState({
      duration: durationMs / 1000,
      position: Math.min(Math.max(positionMs, 0), durationMs) / 1000,
      playbackRate: 1,
    });
  } catch (err) {
    logCaughtError('useMediaSession.setPositionState', err);
  }
}

/**
 * Publishes the current track and transport to the OS media controls
 * (lock screen, hardware media keys, notification shade) via the Media
 * Session API. No-op where the API is unavailable.
 */
export function useMediaSession(track: MediaTrack | null | undefined, handlers: MediaSessionHandlers): void {
  const { onPlay, onPause, onNext, onPrevious } = handlers;
  const trackProvider = track?.provider ?? null;
  const title = track?.name;
  const artist = track?.artists;
  const album = track?.album;
  const image = track?.image;

  useEffect(() => {
    const session = getMediaSession();
    if (!session || typeof MediaMetadata === 'undefined') return;
    session.metadata =
      title === undefined
        ? null
        : new MediaMetadata({
            title,
            artist: artist ?? '',
            album: album ?? '',
            artwork: image ? [{ src: image }] : [],
          });
  }, [title, artist, album, image]);

  useEffect(() => {
    const session = getMediaSession();
    if (!session) return;
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => onPlay()],
      ['pause', () => onPause()],
      ['nexttrack', () => onNext()],
      ['previoustrack', () => onPrevious()],
      [
        'seekto',
        (details) => {
          if (details.seekTime === undefined) return;
          void playbackStore.seek(details.seekTime * 1000, trackProvider);
        },
      ],
    ];
    for (const [action, handler] of actions) setActionHandler(session, action, handler);
    return () => {
      for (const [action] of actions) setActionHandler(session, action, null);
    };
  }, [onPlay, onPause, onNext, onPrevious, trackProvider]);

  useEffect(() => {
    const session = getMediaSession();
    if (!session) return;
    syncPlaybackState(session);
    const unsubscribe = playbackStore.subscribe(() => syncPlaybackState(session));
    return () => {
      unsubscribe();
      session.playbackState = 'none';
    };
  }, []);
}
