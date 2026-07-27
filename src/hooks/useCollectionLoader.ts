import { useCallback, useRef } from 'react';
import type { CollectionRef, CollectionSelection, LoadCollectionResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import { LIKED_SONGS_NAME, isAllMusicRef } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { putTrackList } from '@/services/cache/libraryCache';
import { logQueue } from '@/lib/debugLog';
import { logCaughtError } from '@/utils/logCaughtError';
import { queueSnapshot } from './playerLogicUtils';

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Persist a fetched track list into the shared library cache so cache-backed
 * consumers (e.g. CmdK search) can see any collection the user has opened,
 * regardless of provider. Fire-and-forget: playback never waits on the cache.
 */
function cacheTrackList(ref: CollectionRef, tracks: MediaTrack[]): void {
  if (tracks.length === 0) return;
  putTrackList(ref, tracks).catch((err) => {
    logCaughtError('useCollectionLoader.cacheTrackList', err);
  });
}

interface UseCollectionLoaderProps {
  trackOps: TrackOperations;
  activeDescriptor: ProviderDescriptor | undefined;
  getDescriptor: (providerId: ProviderId) => ProviderDescriptor | undefined;
  setActiveProviderId: (providerId: ProviderId) => void;
  connectedProviderIds: ProviderId[];
  shuffleEnabled: boolean;
  isUnifiedLikedActive: boolean;
  drivingProviderRef: React.MutableRefObject<ProviderId | null>;
  playTrack: (index: number, isSkip?: boolean) => Promise<void>;
  spotifyHandlePlaylistSelect: (ref: CollectionRef) => Promise<MediaTrack[]>;
  stopRadioBase: () => void;
  radioStateIsActive: boolean;
  record: (ref: CollectionRef, name: string, imageUrl?: string | null) => void;
}

interface UseCollectionLoaderReturn {
  loadCollection: (selection: CollectionSelection) => Promise<LoadCollectionResult>;
  playTracksDirectly: (tracks: MediaTrack[], selection: CollectionSelection) => Promise<LoadCollectionResult>;
}

const SUPERSEDED: LoadCollectionResult = { status: 'superseded' };
const EMPTY: LoadCollectionResult = { status: 'empty' };

function loaded(count: number): LoadCollectionResult {
  return { status: 'loaded', count };
}

/** Provider the selection is explicitly pinned to, if any. */
function selectionProvider(selection: CollectionSelection): ProviderId | undefined {
  return selection.type === 'collection' ? selection.ref.provider : selection.provider;
}

export function useCollectionLoader({
  trackOps,
  activeDescriptor,
  getDescriptor,
  setActiveProviderId,
  connectedProviderIds,
  shuffleEnabled,
  isUnifiedLikedActive,
  drivingProviderRef,
  playTrack,
  spotifyHandlePlaylistSelect,
  stopRadioBase,
  radioStateIsActive,
  record,
}: UseCollectionLoaderProps): UseCollectionLoaderReturn {
  const { setError, setIsLoading, setSelection, setTracks, setOriginalTracks, setCurrentTrackIndex, mediaTracksRef } = trackOps;

  const loadGenerationRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const beginLoadGeneration = useCallback((): { generation: number; signal: AbortSignal } => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    loadGenerationRef.current += 1;
    return { generation: loadGenerationRef.current, signal: controller.signal };
  }, []);

  const isStale = useCallback((generation: number): boolean => {
    return loadGenerationRef.current !== generation;
  }, []);

  const beginLoad = useCallback((selection: CollectionSelection): { generation: number; signal: AbortSignal } => {
    const token = beginLoadGeneration();
    setError(null);
    setIsLoading(true);
    setSelection(selection);
    mediaTracksRef.current = [];
    return token;
  }, [beginLoadGeneration, setError, setIsLoading, setSelection, mediaTracksRef]);

  const clearWithError = useCallback((message: string): LoadCollectionResult => {
    setError(message);
    setTracks([]);
    setOriginalTracks([]);
    setCurrentTrackIndex(0);
    setIsLoading(false);
    return EMPTY;
  }, [setError, setTracks, setOriginalTracks, setCurrentTrackIndex, setIsLoading]);

  const handleLoadError = useCallback((err: unknown, fallbackMessage: string): LoadCollectionResult => {
    return clearWithError(err instanceof Error ? err.message : fallbackMessage);
  }, [clearWithError]);

  const applyTracks = useCallback((tracks: MediaTrack[], options?: { forceShuffle?: boolean }) => {
    setOriginalTracks(tracks);
    const shouldShuffle = shuffleEnabled || options?.forceShuffle === true;
    if (shouldShuffle) {
      const indices = shuffleArray(tracks.map((_, i) => i));
      const shuffled = indices.map(i => tracks[i]).filter((t): t is MediaTrack => t !== undefined);
      mediaTracksRef.current = shuffled;
      setTracks(shuffled);
    } else {
      mediaTracksRef.current = tracks;
      setTracks(tracks);
    }
    setCurrentTrackIndex(0);
    setIsLoading(false);
  }, [shuffleEnabled, mediaTracksRef, setOriginalTracks, setTracks, setCurrentTrackIndex, setIsLoading]);

  const loadUnifiedLiked = useCallback(async (selection: CollectionSelection): Promise<LoadCollectionResult> => {
    const { generation, signal } = beginLoad(selection);
    const name = selection.name;
    try {
      const descriptorMap = new Map(
        connectedProviderIds.map(id => [id, getDescriptor(id)])
      );
      const likedProviderIds = connectedProviderIds.filter(
        id => descriptorMap.get(id)?.capabilities.hasLikedCollection,
      );
      const results = await Promise.all(
        likedProviderIds.map(async (id) => {
          const catalog = descriptorMap.get(id)?.catalog;
          if (!catalog) return [];
          return catalog.listTracks({ provider: id, kind: 'liked' }, signal)
            .then((tracks) => {
              cacheTrackList({ provider: id, kind: 'liked' }, tracks);
              return tracks;
            })
            .catch((err: unknown): MediaTrack[] => {
              if (!isAbortError(err)) logCaughtError(`useCollectionLoader.loadUnifiedLiked[${id}]`, err);
              return [];
            });
        }),
      );

      if (isStale(generation)) return SUPERSEDED;

      const merged = results.flat();
      merged.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

      if (merged.length === 0) return clearWithError('No liked tracks found.');

      applyTracks(merged);

      const firstTrack = mediaTracksRef.current[0];
      if (firstTrack) {
        const firstProvider = getDescriptor(firstTrack.provider);
        if (firstProvider) {
          drivingProviderRef.current = firstTrack.provider;
          if (firstTrack.provider !== activeDescriptor?.id) {
            setActiveProviderId(firstTrack.provider);
          }
          queueSnapshot('Unified Liked loaded', merged, mediaTracksRef.current.length, 0);
          if (isStale(generation)) return SUPERSEDED;
          await playTrack(0);
          record(
            { provider: firstTrack.provider, kind: 'liked' },
            name ?? LIKED_SONGS_NAME,
            firstTrack.image ?? null,
          );
        }
      }
      return loaded(merged.length);
    } catch (err) {
      if (isAbortError(err) || isStale(generation)) {
        logCaughtError('useCollectionLoader.loadUnifiedLiked', err);
        return SUPERSEDED;
      }
      return handleLoadError(err, 'Failed to load liked tracks.');
    }
  }, [
    beginLoad, isStale, clearWithError, handleLoadError, applyTracks,
    connectedProviderIds, getDescriptor, activeDescriptor,
    setActiveProviderId, drivingProviderRef, mediaTracksRef, playTrack, record,
  ]);

  const loadContextPlayback = useCallback(async (
    ref: CollectionRef, generation: number,
  ): Promise<LoadCollectionResult> => {
    const providerId = ref.provider;
    setIsLoading(false);
    const prevProvider = drivingProviderRef.current;
    if (prevProvider && prevProvider !== providerId) {
      providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
    }
    drivingProviderRef.current = providerId;
    mediaTracksRef.current = [];
    logQueue('Context playback path — delegating to legacy handler for %o', ref);
    const sdkTracks = await spotifyHandlePlaylistSelect(ref);
    if (isStale(generation)) return SUPERSEDED;
    if (sdkTracks.length === 0) {
      logQueue('Context playback returned 0 tracks');
      return EMPTY;
    }
    mediaTracksRef.current = sdkTracks;
    queueSnapshot('Context playback loaded', sdkTracks, mediaTracksRef.current.length, 0);
    return loaded(sdkTracks.length);
  }, [drivingProviderRef, mediaTracksRef, setIsLoading, spotifyHandlePlaylistSelect, isStale]);

  const loadProviderCollection = useCallback(async (
    selection: CollectionSelection, collectionRef: CollectionRef, targetDescriptor: ProviderDescriptor,
  ): Promise<LoadCollectionResult> => {
    const providerId = targetDescriptor.id;
    const name = selection.name;

    if (activeDescriptor && activeDescriptor.id !== providerId) {
      activeDescriptor.playback.pause().catch(() => {});
    }

    const { generation, signal } = beginLoad(selection);
    try {
      const list = await targetDescriptor.catalog.listTracks(collectionRef, signal);
      cacheTrackList(collectionRef, list);

      if (isStale(generation)) return SUPERSEDED;

      if (list.length === 0 && targetDescriptor.capabilities.hasContextPlaybackFallback) {
        return loadContextPlayback(collectionRef, generation);
      }

      if (list.length === 0) return clearWithError('No tracks found in this collection.');

      applyTracks(list, { forceShuffle: isAllMusicRef(collectionRef) });
      drivingProviderRef.current = providerId;
      queueSnapshot(`${providerId} playlist loaded`, list, mediaTracksRef.current.length, 0);
      if (isStale(generation)) return SUPERSEDED;
      await playTrack(0);
      record(collectionRef, name ?? ('id' in collectionRef ? collectionRef.id : LIKED_SONGS_NAME), list[0]?.image ?? null);
      return loaded(list.length);
    } catch (err) {
      if (isAbortError(err) || isStale(generation)) {
        logCaughtError('useCollectionLoader.loadProviderCollection', err);
        return SUPERSEDED;
      }
      return handleLoadError(err, 'Failed to load collection.');
    }
  }, [
    activeDescriptor, beginLoad, isStale, clearWithError, handleLoadError,
    applyTracks, loadContextPlayback, drivingProviderRef, mediaTracksRef, playTrack, record,
  ]);

  const loadCollection = useCallback(
    async (selection: CollectionSelection): Promise<LoadCollectionResult> => {
      logQueue('loadCollection called — selection=%o', selection);

      if (radioStateIsActive) stopRadioBase();

      if (selection.type === 'liked' && !selection.provider && isUnifiedLikedActive) {
        return loadUnifiedLiked(selection);
      }

      const provider = selectionProvider(selection);
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (targetProviderId && targetProviderId !== activeDescriptor?.id) {
        setActiveProviderId(targetProviderId);
      }

      if (targetDescriptor && targetProviderId) {
        const collectionRef: CollectionRef = selection.type === 'collection'
          ? selection.ref
          : { provider: targetProviderId, kind: 'liked' };
        return loadProviderCollection(selection, collectionRef, targetDescriptor);
      }

      return EMPTY;
    },
    [
      activeDescriptor, getDescriptor, setActiveProviderId,
      isUnifiedLikedActive, loadUnifiedLiked, loadProviderCollection,
      radioStateIsActive, stopRadioBase,
    ]
  );

  const playTracksDirectly = useCallback(
    async (tracks: MediaTrack[], selection: CollectionSelection): Promise<LoadCollectionResult> => {
      if (radioStateIsActive) stopRadioBase();

      const { generation } = beginLoadGeneration();

      const provider = selectionProvider(selection);
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (targetDescriptor && activeDescriptor && activeDescriptor.id !== targetDescriptor.id) {
        activeDescriptor.playback.pause().catch(() => {});
      }

      setError(null);
      setIsLoading(true);
      setSelection(selection);
      mediaTracksRef.current = [];

      if (tracks.length === 0) {
        setTracks([]);
        setOriginalTracks([]);
        setCurrentTrackIndex(0);
        setIsLoading(false);
        return EMPTY;
      }

      applyTracks(tracks);

      if (targetProviderId) {
        drivingProviderRef.current = targetProviderId;
        if (targetProviderId !== activeDescriptor?.id) {
          setActiveProviderId(targetProviderId);
        }
      }

      queueSnapshot('Direct tracks loaded', tracks, mediaTracksRef.current.length, 0);
      if (isStale(generation)) return SUPERSEDED;
      await playTrack(0);
      return loaded(tracks.length);
    },
    [
      radioStateIsActive, stopRadioBase, beginLoadGeneration, isStale,
      getDescriptor, activeDescriptor,
      setError, setIsLoading, setSelection, mediaTracksRef,
      setTracks, setOriginalTracks, setCurrentTrackIndex,
      applyTracks, drivingProviderRef, setActiveProviderId, playTrack,
    ]
  );

  return {
    loadCollection,
    playTracksDirectly,
  };
}
