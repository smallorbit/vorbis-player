/**
 * Background resolution of non-Spotify tracks to Spotify URIs.
 *
 * When a playlist is loaded that contains non-Spotify tracks (e.g. Dropbox),
 * this hook resolves them to Spotify equivalents in the background so that
 * the Spotify queue sync can include them when playback starts.
 */

import { useEffect, useRef } from 'react';
import type { Track } from '@/services/spotify';
import { spotifyAuth } from '@/services/spotify';
import { spotifyQueueSync } from '@/services/spotifyQueueSync';

interface UseSpotifyQueueSyncProps {
  tracks: Track[];
}

export function useSpotifyQueueSync({ tracks }: UseSpotifyQueueSyncProps): void {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!spotifyAuth.isAuthenticated() || tracks.length === 0) return;
    if (!spotifyQueueSync.isResolveEnabled()) return;

    const hasNonSpotify = tracks.some(t => t.provider && t.provider !== 'spotify');
    if (!hasNonSpotify) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    spotifyQueueSync.resolveTracksInBackground(tracks, controller.signal).catch(() => {});

    return () => controller.abort();
  }, [tracks]);
}
