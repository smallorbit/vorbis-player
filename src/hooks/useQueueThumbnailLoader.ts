import { useEffect, useRef, useCallback } from 'react';
import type { Track } from '@/services/spotify';
import type { MediaTrack } from '@/types/domain';
import { getAlbumArt } from '@/providers/dropbox/dropboxArtCache';
import { providerRegistry } from '@/providers/registry';
import type { DropboxCatalogAdapter } from '@/providers/dropbox/dropboxCatalogAdapter';
import { logQueue } from '@/lib/debugLog';

/** Maximum number of concurrent Dropbox API art fetches. */
const FETCH_CONCURRENCY = 3;

/**
 * Progressively loads missing thumbnails for Dropbox tracks in the queue.
 *
 * Phase 1: Hydrates from the IndexedDB album art cache (fast, no network).
 * Phase 2: For albums still missing art, scans their Dropbox directories
 *          for cover images and fetches them.
 *
 * Updates are batched so the queue UI re-renders efficiently.
 */
export function useQueueThumbnailLoader(
  tracks: readonly Track[],
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>,
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
) {
  // Track which album IDs we've already attempted to resolve (avoid re-fetching)
  const attemptedAlbumIds = useRef(new Set<string>());

  // Abort controller for in-flight operations when tracks change
  const abortRef = useRef<AbortController | null>(null);

  const applyImageUpdates = useCallback(
    (updates: Map<string, string>) => {
      if (updates.size === 0) return;
      logQueue('thumbnailLoader — applying %d image updates', updates.size);

      // Update mediaTracksRef
      for (const mt of mediaTracksRef.current) {
        if (mt.provider === 'dropbox' && !mt.image && mt.albumId) {
          const img = updates.get(mt.albumId);
          if (img) mt.image = img;
        }
      }

      // Update UI tracks
      setTracks((prev) =>
        prev.map((t) => {
          if (t.provider === 'dropbox' && !t.image && t.album_id) {
            const img = updates.get(t.album_id);
            if (img) return { ...t, image: img };
          }
          return t;
        }),
      );
    },
    [mediaTracksRef, setTracks],
  );

  useEffect(() => {
    // Find Dropbox tracks without images
    const missing = tracks.filter(
      (t) => t.provider === 'dropbox' && !t.image && t.album_id,
    );
    if (missing.length === 0) return;

    // Dedupe by album ID (multiple tracks share the same album art)
    const albumIds = [...new Set(missing.map((t) => t.album_id!))];
    // Filter out already-attempted album IDs
    const toResolve = albumIds.filter((id) => !attemptedAlbumIds.current.has(id));
    if (toResolve.length === 0) return;

    // Mark as attempted immediately so we don't re-trigger
    for (const id of toResolve) attemptedAlbumIds.current.add(id);

    // Cancel any previous in-flight operation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    logQueue('thumbnailLoader — resolving art for %d albums', toResolve.length);

    const run = async () => {
      // ── Phase 1: IndexedDB cache lookup ──
      const cacheResults = new Map<string, string>();
      const uncached: string[] = [];

      await Promise.all(
        toResolve.map(async (albumId) => {
          const cached = await getAlbumArt(albumId);
          if (cached) {
            cacheResults.set(albumId, cached);
          } else {
            uncached.push(albumId);
          }
        }),
      );

      if (controller.signal.aborted) return;

      // Apply cache hits immediately
      if (cacheResults.size > 0) {
        applyImageUpdates(cacheResults);
        logQueue(
          'thumbnailLoader — phase 1 (cache): resolved %d, remaining %d',
          cacheResults.size,
          uncached.length,
        );
      }

      // ── Phase 2: Fetch from Dropbox API for uncached albums ──
      if (uncached.length === 0) return;

      const dropbox = providerRegistry.get('dropbox');
      if (!dropbox) return;

      const catalog = dropbox.catalog as DropboxCatalogAdapter;
      if (typeof catalog.resolveAlbumArt !== 'function') return;

      // Process in batches to limit concurrency
      const fetchResults = new Map<string, string>();

      for (let i = 0; i < uncached.length; i += FETCH_CONCURRENCY) {
        if (controller.signal.aborted) return;
        const batch = uncached.slice(i, i + FETCH_CONCURRENCY);

        const results = await Promise.all(
          batch.map(async (albumId) => {
            try {
              const art = await catalog.resolveAlbumArt(albumId, controller.signal);
              return art ? ([albumId, art] as const) : null;
            } catch {
              return null;
            }
          }),
        );

        for (const result of results) {
          if (result) fetchResults.set(result[0], result[1]);
        }

        // Apply each batch as it completes for progressive loading
        if (fetchResults.size > 0 && !controller.signal.aborted) {
          applyImageUpdates(fetchResults);
          logQueue('thumbnailLoader — phase 2 (fetch): resolved %d so far', fetchResults.size);
          fetchResults.clear();
        }
      }
    };

    run().catch(() => {});

    return () => controller.abort();
  }, [tracks, applyImageUpdates]);

  // Reset attempted set when queue is cleared
  useEffect(() => {
    if (tracks.length === 0) {
      attemptedAlbumIds.current.clear();
    }
  }, [tracks.length]);
}
