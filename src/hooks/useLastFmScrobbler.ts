/**
 * Hook that watches playback state and sends Last.fm scrobble / now-playing events.
 *
 * Scrobble rules (per Last.fm spec):
 * - Track duration must be > 30 seconds
 * - Scrobble after the track has been playing for ≥ 50% of its duration OR ≥ 4 minutes
 *   (whichever comes first)
 * - Only scrobble once per track play
 * - Send "now playing" when a new track starts
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  isScrobblingAuthenticated,
  updateNowPlaying,
  scrobble,
} from '@/services/lastfmScrobbler';
import type { ScrobbleTrack } from '@/services/lastfmScrobbler';

const MIN_TRACK_DURATION_MS = 30_000;
const MAX_SCROBBLE_THRESHOLD_MS = 4 * 60 * 1000; // 4 minutes

/** Minimal track shape the scrobbler needs — compatible with both Track and MediaTrack. */
interface ScrobbleableTrack {
  id: string;
  name: string;
  artists: string;
  album?: string;
  durationMs?: number;
}

interface UseLastFmScrobblerProps {
  currentTrack: ScrobbleableTrack | null;
  isPlaying: boolean;
  playbackPosition: number;
  enabled: boolean;
}

export function useLastFmScrobbler({
  currentTrack,
  isPlaying,
  playbackPosition,
  enabled,
}: UseLastFmScrobblerProps): void {
  // Track ID we last sent "now playing" for
  const nowPlayingTrackIdRef = useRef<string | null>(null);
  // Track ID we already scrobbled for this play
  const scrobbledTrackIdRef = useRef<string | null>(null);
  // Accumulated play time for the current track (ms)
  const accumulatedTimeRef = useRef(0);
  // Last timestamp we recorded for time accumulation
  const lastTickRef = useRef(0);
  // Last known position (to detect track restarts/seeks)
  const lastPositionRef = useRef(0);

  const buildScrobbleTrack = useCallback((track: ScrobbleableTrack): ScrobbleTrack => ({
    artist: track.artists,
    track: track.name,
    album: track.album || undefined,
    duration: track.durationMs ? Math.round(track.durationMs / 1000) : undefined,
  }), []);

  // Reset tracking state when the track changes
  const trackId = currentTrack?.id ?? null;
  useEffect(() => {
    accumulatedTimeRef.current = 0;
    lastTickRef.current = 0;
    lastPositionRef.current = 0;
    scrobbledTrackIdRef.current = null;
    nowPlayingTrackIdRef.current = null;
  }, [trackId]);

  // Send "now playing" when a new track starts playing
  useEffect(() => {
    if (!enabled || !isPlaying || !currentTrack || !isScrobblingAuthenticated()) return;
    if (nowPlayingTrackIdRef.current === currentTrack.id) return;

    nowPlayingTrackIdRef.current = currentTrack.id;
    updateNowPlaying(buildScrobbleTrack(currentTrack));
  }, [enabled, isPlaying, currentTrack, buildScrobbleTrack]);

  // Accumulate play time and scrobble when threshold is met
  useEffect(() => {
    if (!enabled || !isPlaying || !currentTrack || !isScrobblingAuthenticated()) {
      // Not playing — pause accumulation
      lastTickRef.current = 0;
      return;
    }

    const duration = currentTrack.duration_ms ?? 0;
    if (duration < MIN_TRACK_DURATION_MS) return;
    if (scrobbledTrackIdRef.current === currentTrack.id) return;

    const now = Date.now();

    // Detect position jumps that indicate a seek or track restart.
    // Small backward jumps (< 2s) are normal jitter from providers.
    const positionDelta = playbackPosition - lastPositionRef.current;
    if (positionDelta < -2000) {
      // Significant backward seek — reset accumulation
      accumulatedTimeRef.current = 0;
      lastTickRef.current = now;
      lastPositionRef.current = playbackPosition;
      return;
    }

    if (lastTickRef.current > 0) {
      const elapsed = now - lastTickRef.current;
      // Cap elapsed to avoid huge jumps from tab suspension
      accumulatedTimeRef.current += Math.min(elapsed, 5000);
    }
    lastTickRef.current = now;
    lastPositionRef.current = playbackPosition;

    const threshold = Math.min(duration / 2, MAX_SCROBBLE_THRESHOLD_MS);
    if (accumulatedTimeRef.current >= threshold) {
      scrobbledTrackIdRef.current = currentTrack.id;
      scrobble(buildScrobbleTrack(currentTrack));
    }
  }, [enabled, isPlaying, currentTrack, playbackPosition, buildScrobbleTrack]);
}
