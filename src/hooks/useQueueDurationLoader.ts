import { useEffect, useRef, useCallback } from 'react';
import type { MediaTrack } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';

/** Maximum number of concurrent duration resolution calls per batch. */
const RESOLVE_CONCURRENCY = 2;

/**
 * Progressively discovers missing durations for tracks in the queue.
 *
 * For each track missing a duration, delegates to the track's provider
 * via `catalog.resolveDuration()`. Providers handle caching, temporary
 * link fetching, and audio probing internally.
 *
 * Updates are applied progressively so the queue UI fills in durations.
 */
export function useQueueDurationLoader(
  tracks: readonly MediaTrack[],
  setTracks: React.Dispatch<React.SetStateAction<MediaTrack[]>>,
) {
  const attemptedTrackIds = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);

  const applyDurationUpdates = useCallback(
    (updates: Map<string, number>) => {
      if (updates.size === 0) return;
      logQueue('durationLoader — applying %d duration updates', updates.size);

      setTracks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (!t.durationMs) {
            const dur = updates.get(t.id);
            if (dur) { changed = true; return { ...t, durationMs: dur }; }
          }
          return t;
        });
        return changed ? next : prev;
      });
    },
    [setTracks],
  );

  useEffect(() => {
    const missing = tracks.filter((t) => !t.durationMs);
    if (missing.length === 0) return;

    const toResolve = missing.filter((t) => !attemptedTrackIds.current.has(t.id));
    if (toResolve.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    logQueue('durationLoader — resolving durations for %d tracks', toResolve.length);

    const run = async () => {
      for (let i = 0; i < toResolve.length; i += RESOLVE_CONCURRENCY) {
        if (controller.signal.aborted) return;
        const batch = toResolve.slice(i, i + RESOLVE_CONCURRENCY);
        const batchResults = new Map<string, number>();

        await Promise.all(
          batch.map(async (track) => {
            const mt = tracks.find((m) => m.id === track.id);
            if (!mt) return;
            try {
              const provider = providerRegistry.get(mt.provider);
              const durationMs = await provider?.catalog.resolveDuration?.(mt);
              if (durationMs) {
                batchResults.set(track.id, durationMs);
              }
              if (!controller.signal.aborted) attemptedTrackIds.current.add(track.id);
            } catch {
              if (!controller.signal.aborted) attemptedTrackIds.current.add(track.id);
            }
          }),
        );

        if (batchResults.size > 0 && !controller.signal.aborted) {
          applyDurationUpdates(batchResults);
          logQueue('durationLoader — resolved %d in batch', batchResults.size);
        }
      }
    };

    run().catch(() => {});

    return () => controller.abort();
  }, [tracks, applyDurationUpdates]);

  useEffect(() => {
    if (tracks.length === 0) {
      attemptedTrackIds.current.clear();
    }
  }, [tracks.length]);
}
