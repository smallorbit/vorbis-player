import { useEffect, useRef, useCallback } from 'react';
import type { Track } from '@/services/spotify';
import type { MediaTrack } from '@/types/domain';
import { getDurationsMap, putDurationMs } from '@/providers/dropbox/dropboxArtCache';
import { providerRegistry } from '@/providers/registry';
import type { DropboxCatalogAdapter } from '@/providers/dropbox/dropboxCatalogAdapter';
import { logQueue } from '@/lib/debugLog';

/** Maximum number of concurrent audio metadata probes. */
const PROBE_CONCURRENCY = 2;

/** Timeout for a single metadata probe (ms). */
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Probe an audio URL for its duration using a metadata-only Audio element.
 * Returns duration in milliseconds or null on failure/timeout.
 */
function probeAudioDuration(url: string, signal: AbortSignal): Promise<number | null> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(null); return; }

    const audio = new Audio();
    audio.preload = 'metadata';

    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      cleanup();
      resolve(null);
    }, PROBE_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onError);
      audio.src = '';
      audio.load();
    };

    const onAbort = () => { cleanup(); resolve(null); };
    signal.addEventListener('abort', onAbort, { once: true });

    const onMeta = () => {
      signal.removeEventListener('abort', onAbort);
      const dur = audio.duration;
      cleanup();
      if (!isNaN(dur) && dur > 0) {
        resolve(Math.floor(dur * 1000));
      } else {
        resolve(null);
      }
    };

    const onError = () => {
      signal.removeEventListener('abort', onAbort);
      cleanup();
      resolve(null);
    };

    audio.addEventListener('loadedmetadata', onMeta, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = url;
  });
}

/**
 * Progressively discovers missing durations for Dropbox tracks in the queue.
 *
 * Phase 1: Hydrates from the IndexedDB durations cache (fast, no network).
 * Phase 2: For tracks still missing durations, probes audio metadata via
 *          Dropbox temporary links with bounded concurrency.
 *
 * Updates are applied progressively so the queue UI fills in durations.
 */
export function useQueueDurationLoader(
  tracks: readonly Track[],
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>,
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
) {
  const attemptedTrackIds = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);

  const applyDurationUpdates = useCallback(
    (updates: Map<string, number>) => {
      if (updates.size === 0) return;
      logQueue('durationLoader — applying %d duration updates', updates.size);

      // Update mediaTracksRef
      for (const mt of mediaTracksRef.current) {
        if (mt.provider === 'dropbox' && !mt.durationMs) {
          const dur = updates.get(mt.id);
          if (dur) mt.durationMs = dur;
        }
      }

      // Update UI tracks (return prev unchanged if no actual updates to avoid re-renders)
      setTracks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.provider === 'dropbox' && !t.duration_ms) {
            const dur = updates.get(t.id);
            if (dur) { changed = true; return { ...t, duration_ms: dur }; }
          }
          return t;
        });
        return changed ? next : prev;
      });
    },
    [mediaTracksRef, setTracks],
  );

  useEffect(() => {
    // Find Dropbox tracks without durations
    const missing = tracks.filter(
      (t) => t.provider === 'dropbox' && !t.duration_ms,
    );
    if (missing.length === 0) return;

    // Filter out already-attempted track IDs
    const toResolve = missing.filter((t) => !attemptedTrackIds.current.has(t.id));
    if (toResolve.length === 0) return;

    // Cancel any previous in-flight operation (aborted probes are not marked as attempted,
    // so they will be retried on the next run)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    logQueue('durationLoader — resolving durations for %d tracks', toResolve.length);

    const run = async () => {
      // ── Phase 1: IndexedDB cache lookup ──
      const trackIds = toResolve.map((t) => t.id);
      const durationsMap = await getDurationsMap(trackIds);

      if (controller.signal.aborted) return;

      // Apply cache hits immediately and mark them as attempted
      if (durationsMap.size > 0) {
        for (const id of durationsMap.keys()) attemptedTrackIds.current.add(id);
        applyDurationUpdates(durationsMap);
        logQueue(
          'durationLoader — phase 1 (cache): resolved %d, remaining %d',
          durationsMap.size,
          toResolve.length - durationsMap.size,
        );
      }

      // ── Phase 2: Probe via Dropbox temporary links ──
      const uncached = toResolve.filter((t) => !durationsMap.has(t.id));
      if (uncached.length === 0) return;

      const dropbox = providerRegistry.get('dropbox');
      if (!dropbox) return;

      const catalog = dropbox.catalog as DropboxCatalogAdapter;
      if (typeof catalog.getTemporaryLink !== 'function') return;

      // Find matching MediaTracks to get playbackRef paths
      const mediaMap = new Map<string, MediaTrack>();
      for (const mt of mediaTracksRef.current) {
        if (mt.provider === 'dropbox') mediaMap.set(mt.id, mt);
      }

      for (let i = 0; i < uncached.length; i += PROBE_CONCURRENCY) {
        if (controller.signal.aborted) return;
        const batch = uncached.slice(i, i + PROBE_CONCURRENCY);
        const batchResults = new Map<string, number>();

        await Promise.all(
          batch.map(async (track) => {
            const mt = mediaMap.get(track.id);
            if (!mt) return;
            try {
              const url = await catalog.getTemporaryLink(mt.playbackRef.ref);
              const durationMs = await probeAudioDuration(url, controller.signal);
              if (durationMs) {
                batchResults.set(track.id, durationMs);
                putDurationMs(track.id, durationMs).catch(() => {});
              }
              // Mark as attempted only on definitive success/failure (not abort)
              if (!controller.signal.aborted) attemptedTrackIds.current.add(track.id);
            } catch {
              if (!controller.signal.aborted) attemptedTrackIds.current.add(track.id);
            }
          }),
        );

        if (batchResults.size > 0 && !controller.signal.aborted) {
          applyDurationUpdates(batchResults);
          logQueue('durationLoader — phase 2 (probe): resolved %d so far', batchResults.size);
        }
      }
    };

    run().catch(() => {});

    return () => controller.abort();
  }, [tracks, applyDurationUpdates, mediaTracksRef]);

  // Reset attempted set when queue is cleared
  useEffect(() => {
    if (tracks.length === 0) {
      attemptedTrackIds.current.clear();
    }
  }, [tracks.length]);
}
