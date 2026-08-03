import type { PlaybackSelection } from './domain';

/**
 * Load-status operations shared by the queue-loading hooks. Queue content
 * itself is owned by `queueStore` (src/stores/queueStore.ts) — mutate it
 * through the store's mutators, never through React state.
 */
export interface TrackOperations {
  setSelection: (selection: PlaybackSelection | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
}
