/**
 * Hook for saving the current queue as a Spotify playlist.
 *
 * Resolves non-Spotify tracks to Spotify equivalents (using the queue sync
 * resolution cache or on-demand search) when the cross-provider resolve
 * setting is enabled, then creates a new Spotify playlist with the results.
 */

import { useState, useCallback } from 'react';
import type { Track } from '@/services/spotify';
import {
  spotifyAuth,
  searchTrack,
  createPlaylist,
  addTracksToPlaylist,
} from '@/services/spotify';
import { spotifyQueueSync } from '@/services/spotifyQueueSync';

export type SaveQueueStatus = 'idle' | 'saving' | 'success' | 'error';

export interface SaveQueueResult {
  playlistUrl?: string;
  totalTracks: number;
  skippedTracks: number;
}

interface UseSaveQueueAsPlaylistReturn {
  saveQueueAsPlaylist: (name: string, tracks: Track[]) => Promise<SaveQueueResult>;
  status: SaveQueueStatus;
  error: string | null;
  lastResult: SaveQueueResult | null;
  resetStatus: () => void;
}

const MAX_CONCURRENT_RESOLVE = 3;

/**
 * Resolve a list of tracks to Spotify URIs.
 * Spotify tracks use their URI directly. Non-Spotify tracks check the queue
 * sync resolution cache first, then fall back to on-demand search if the
 * cross-provider resolve setting is enabled.
 */
async function resolveTrackUris(tracks: Track[]): Promise<{ uris: string[]; skipped: number }> {
  const resolveEnabled = spotifyQueueSync.isResolveEnabled();

  // Build a slot per track to preserve original queue order
  const slots: (string | null)[] = new Array(tracks.length).fill(null);
  const toResolve: { index: number; track: Track }[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.provider === 'spotify' || !track.provider) {
      slots[i] = track.uri ?? null;
    } else if (resolveEnabled) {
      toResolve.push({ index: i, track });
    }
    // else: slot stays null → skipped
  }

  // Resolve non-Spotify tracks in batches, writing results back into slots
  for (let i = 0; i < toResolve.length; i += MAX_CONCURRENT_RESOLVE) {
    const chunk = toResolve.slice(i, i + MAX_CONCURRENT_RESOLVE);
    const results = await Promise.all(
      chunk.map(async ({ track }) => {
        // Check queue sync cache first
        const cached = spotifyQueueSync.getResolvedUri(track.id);
        if (cached) return cached;
        if (cached === null) return null; // previously unresolvable

        // On-demand search
        try {
          const found = await searchTrack(track.artists, track.name);
          return found?.uri ?? null;
        } catch {
          return null;
        }
      }),
    );

    for (let j = 0; j < chunk.length; j++) {
      slots[chunk[j].index] = results[j];
    }
  }

  // Collect results in original order
  const uris: string[] = [];
  let skipped = 0;
  for (const uri of slots) {
    if (uri) uris.push(uri);
    else skipped++;
  }

  return { uris, skipped };
}

export function useSaveQueueAsPlaylist(): UseSaveQueueAsPlaylistReturn {
  const [status, setStatus] = useState<SaveQueueStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SaveQueueResult | null>(null);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError(null);
    setLastResult(null);
  }, []);

  const saveQueueAsPlaylist = useCallback(async (name: string, tracks: Track[]): Promise<SaveQueueResult> => {
    if (!spotifyAuth.isAuthenticated()) {
      const err = 'Spotify is not connected';
      setError(err);
      setStatus('error');
      throw new Error(err);
    }

    if (tracks.length === 0) {
      const err = 'Queue is empty';
      setError(err);
      setStatus('error');
      throw new Error(err);
    }

    setStatus('saving');
    setError(null);

    try {
      const { uris, skipped } = await resolveTrackUris(tracks);

      if (uris.length === 0) {
        const err = 'No tracks could be resolved to Spotify';
        setError(err);
        setStatus('error');
        throw new Error(err);
      }

      const playlist = await createPlaylist(name, {
        description: `Created from Vorbis Player queue`,
      });

      await addTracksToPlaylist(playlist.id, uris);

      const result: SaveQueueResult = {
        playlistUrl: playlist.url,
        totalTracks: uris.length,
        skippedTracks: skipped,
      };

      setLastResult(result);
      setStatus('success');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save playlist';
      setError(message);
      setStatus('error');
      throw err;
    }
  }, []);

  return { saveQueueAsPlaylist, status, error, lastResult, resetStatus };
}
