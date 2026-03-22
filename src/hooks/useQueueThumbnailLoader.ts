import { useEffect, useRef, useCallback } from 'react';
import type { Track } from '@/services/spotify';
import type { MediaTrack } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';

/** Maximum number of concurrent art resolution calls per batch. */
const FETCH_CONCURRENCY = 3;

/**
 * Progressively loads missing thumbnails for tracks in the queue.
 *
 * For each track missing artwork, delegates to the track's provider
 * via `catalog.resolveArtwork()`. Providers handle caching and
 * network fetching internally.
 *
 * Updates are batched so the queue UI re-renders efficiently.
 */
export function useQueueThumbnailLoader(
  tracks: readonly Track[],
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>,
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
) {
  const attemptedAlbumIds = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);

  const applyImageUpdates = useCallback(
    (updates: Map<string, string>) => {
      if (updates.size === 0) return;
      logQueue('thumbnailLoader — applying %d image updates', updates.size);

      for (const mt of mediaTracksRef.current) {
        if (!mt.image && mt.albumId) {
          const img = updates.get(mt.albumId);
          if (img) mt.image = img;
        }
      }

      setTracks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (!t.image && t.album_id) {
            const img = updates.get(t.album_id);
            if (img) { changed = true; return { ...t, image: img }; }
          }
          return t;
        });
        return changed ? next : prev;
      });
    },
    [mediaTracksRef, setTracks],
  );

  useEffect(() => {
    const missing = tracks.filter((t) => !t.image && t.album_id);
    if (missing.length === 0) return;

    const albumIds = [...new Set(missing.map((t) => t.album_id!))];
    const toResolve = albumIds.filter((id) => !attemptedAlbumIds.current.has(id));
    if (toResolve.length === 0) return;

    for (const id of toResolve) attemptedAlbumIds.current.add(id);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    logQueue('thumbnailLoader — resolving art for %d albums', toResolve.length);

    const run = async () => {
      for (let i = 0; i < toResolve.length; i += FETCH_CONCURRENCY) {
        if (controller.signal.aborted) return;
        const batch = toResolve.slice(i, i + FETCH_CONCURRENCY);
        const batchResults = new Map<string, string>();

        await Promise.all(
          batch.map(async (albumId) => {
            // Find a track with this albumId to determine the provider
            const mt = mediaTracksRef.current.find((m) => m.albumId === albumId);
            if (!mt) return;
            try {
              const provider = providerRegistry.get(mt.provider);
              const art = await provider?.catalog.resolveArtwork?.(albumId, controller.signal);
              if (art) batchResults.set(albumId, art);
            } catch {
              // Swallow errors for individual album art resolution
            }
          }),
        );

        if (batchResults.size > 0 && !controller.signal.aborted) {
          applyImageUpdates(batchResults);
          logQueue('thumbnailLoader — resolved %d in batch', batchResults.size);
        }
      }
    };

    run().catch(() => {});

    return () => controller.abort();
  }, [tracks, applyImageUpdates, mediaTracksRef]);

  useEffect(() => {
    if (tracks.length === 0) {
      attemptedAlbumIds.current.clear();
    }
  }, [tracks.length]);
}
