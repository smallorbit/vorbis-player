/**
 * Registers Web Media Session API handlers for OS-level media key support.
 * This enables F7 (previous), F8 (play/pause), and F9 (next) on macOS,
 * as well as media controls in the browser's native media UI and system tray.
 */

import { useEffect } from 'react';
import type { Track } from '@/services/spotify';

interface MediaSessionHandlers {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const useMediaSession = (
  currentTrack: Track | null,
  isPlaying: boolean,
  handlers: MediaSessionHandlers
) => {
  const { onPlayPause, onNext, onPrevious } = handlers;

  // Update metadata when track changes
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.artists,
      album: currentTrack.album,
      artwork: currentTrack.image
        ? [{ src: currentTrack.image, sizes: '300x300', type: 'image/jpeg' }]
        : undefined,
    });
  }, [currentTrack]);

  // Update playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Register action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', onPlayPause);
    navigator.mediaSession.setActionHandler('pause', onPlayPause);
    navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
    navigator.mediaSession.setActionHandler('nexttrack', onNext);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [onPlayPause, onPrevious, onNext]);
};
