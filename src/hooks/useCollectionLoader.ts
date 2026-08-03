import { useCallback } from 'react';
import type { CollectionRef, CollectionSelection, LoadCollectionResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import { LIKED_SONGS_NAME, isAllMusicRef } from '@/constants/playlist';
import { providerRegistry } from '@/providers/registry';
import { putTrackList } from '@/services/cache/libraryCache';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import { useNewestWins, type NewestWinsToken } from '@/hooks/useNewestWins';
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
  isUnifiedLikedActive: boolean;
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
  isUnifiedLikedActive,
  playTrack,
  spotifyHandlePlaylistSelect,
  stopRadioBase,
  radioStateIsActive,
  record,
}: UseCollectionLoaderProps): UseCollectionLoaderReturn {
  const { setError, setIsLoading, setSelection } = trackOps;

  // Newest-wins guard for the queue's collection load: a later load (or a
  // direct-play) supersedes an in-flight one, aborting its fetch and staling
  // its token so a late resolution can never clobber the newer queue.
  const loadGuard = useNewestWins();

  const beginLoad = useCallback((selection: CollectionSelection): NewestWinsToken => {
    const token = loadGuard.begin();
    setError(null);
    setIsLoading(true);
    setSelection(selection);
    return token;
  }, [loadGuard, setError, setIsLoading, setSelection]);

  const clearWithError = useCallback((message: string): LoadCollectionResult => {
    setError(message);
    queueStore.clear();
    setIsLoading(false);
    return EMPTY;
  }, [setError, setIsLoading]);

  const handleLoadError = useCallback((err: unknown, fallbackMessage: string): LoadCollectionResult => {
    return clearWithError(err instanceof Error ? err.message : fallbackMessage);
  }, [clearWithError]);

  const applyTracks = useCallback((tracks: MediaTrack[], options?: { forceShuffle?: boolean }) => {
    queueStore.loadQueue(tracks, { forceShuffle: options?.forceShuffle === true });
    setIsLoading(false);
  }, [setIsLoading]);

  const loadUnifiedLiked = useCallback(async (selection: CollectionSelection): Promise<LoadCollectionResult> => {
    const token = beginLoad(selection);
    const { signal } = token;
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

      if (token.isStale()) return SUPERSEDED;

      const merged = results.flat();
      merged.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

      if (merged.length === 0) return clearWithError('No liked tracks found.');

      applyTracks(merged);

      const firstTrack = queueStore.getTracks()[0];
      if (firstTrack) {
        const firstProvider = getDescriptor(firstTrack.provider);
        if (firstProvider) {
          playbackStore.setDrivingProvider(firstTrack.provider);
          if (firstTrack.provider !== activeDescriptor?.id) {
            setActiveProviderId(firstTrack.provider);
          }
          queueSnapshot('Unified Liked loaded', merged, queueStore.getTracks().length, 0);
          if (token.isStale()) return SUPERSEDED;
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
      if (isAbortError(err) || token.isStale()) {
        logCaughtError('useCollectionLoader.loadUnifiedLiked', err);
        return SUPERSEDED;
      }
      return handleLoadError(err, 'Failed to load liked tracks.');
    }
  }, [
    beginLoad, clearWithError, handleLoadError, applyTracks,
    connectedProviderIds, getDescriptor, activeDescriptor,
    setActiveProviderId, playTrack, record,
  ]);

  const loadContextPlayback = useCallback(async (
    ref: CollectionRef, token: NewestWinsToken,
  ): Promise<LoadCollectionResult> => {
    const providerId = ref.provider;
    setIsLoading(false);
    const prevProvider = playbackStore.getSnapshot().drivingProviderId;
    if (prevProvider && prevProvider !== providerId) {
      providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
    }
    playbackStore.setDrivingProvider(providerId);
    logQueue('Context playback path — delegating to legacy handler for %o', ref);
    // spotifyHandlePlaylistSelect mirrors the SDK's track window straight into
    // the queue store when it succeeds.
    const sdkTracks = await spotifyHandlePlaylistSelect(ref);
    if (token.isStale()) return SUPERSEDED;
    if (sdkTracks.length === 0) {
      logQueue('Context playback returned 0 tracks');
      return EMPTY;
    }
    queueSnapshot('Context playback loaded', sdkTracks, queueStore.getTracks().length, 0);
    return loaded(sdkTracks.length);
  }, [setIsLoading, spotifyHandlePlaylistSelect]);

  const loadProviderCollection = useCallback(async (
    selection: CollectionSelection, collectionRef: CollectionRef, targetDescriptor: ProviderDescriptor,
  ): Promise<LoadCollectionResult> => {
    const providerId = targetDescriptor.id;
    const name = selection.name;

    if (activeDescriptor && activeDescriptor.id !== providerId) {
      activeDescriptor.playback.pause().catch(() => {});
    }

    const token = beginLoad(selection);
    try {
      const list = await targetDescriptor.catalog.listTracks(collectionRef, token.signal);
      cacheTrackList(collectionRef, list);

      if (token.isStale()) return SUPERSEDED;

      if (list.length === 0 && targetDescriptor.capabilities.hasContextPlaybackFallback) {
        return loadContextPlayback(collectionRef, token);
      }

      if (list.length === 0) return clearWithError('No tracks found in this collection.');

      applyTracks(list, { forceShuffle: isAllMusicRef(collectionRef) });
      playbackStore.setDrivingProvider(providerId);
      queueSnapshot(`${providerId} playlist loaded`, list, queueStore.getTracks().length, 0);
      if (token.isStale()) return SUPERSEDED;
      await playTrack(0);
      record(collectionRef, name ?? ('id' in collectionRef ? collectionRef.id : LIKED_SONGS_NAME), list[0]?.image ?? null);
      return loaded(list.length);
    } catch (err) {
      if (isAbortError(err) || token.isStale()) {
        logCaughtError('useCollectionLoader.loadProviderCollection', err);
        return SUPERSEDED;
      }
      return handleLoadError(err, 'Failed to load collection.');
    }
  }, [
    activeDescriptor, beginLoad, clearWithError, handleLoadError,
    applyTracks, loadContextPlayback, playTrack, record,
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

      const token = loadGuard.begin();

      const provider = selectionProvider(selection);
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (targetDescriptor && activeDescriptor && activeDescriptor.id !== targetDescriptor.id) {
        activeDescriptor.playback.pause().catch(() => {});
      }

      setError(null);
      setIsLoading(true);
      setSelection(selection);

      if (tracks.length === 0) {
        queueStore.clear();
        setIsLoading(false);
        return EMPTY;
      }

      applyTracks(tracks);

      if (targetProviderId) {
        playbackStore.setDrivingProvider(targetProviderId);
        if (targetProviderId !== activeDescriptor?.id) {
          setActiveProviderId(targetProviderId);
        }
      }

      queueSnapshot('Direct tracks loaded', tracks, queueStore.getTracks().length, 0);
      if (token.isStale()) return SUPERSEDED;
      await playTrack(0);
      return loaded(tracks.length);
    },
    [
      radioStateIsActive, stopRadioBase, loadGuard,
      getDescriptor, activeDescriptor,
      setError, setIsLoading, setSelection,
      applyTracks, setActiveProviderId, playTrack,
    ]
  );

  return {
    loadCollection,
    playTracksDirectly,
  };
}
