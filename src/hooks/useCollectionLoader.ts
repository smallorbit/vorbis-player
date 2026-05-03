import { useCallback } from 'react';
import type { CollectionRef, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, isAllMusicRef, resolvePlaylistRef } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { shouldUseMockProvider } from '@/providers/mock/shouldUseMockProvider';
import { logQueue } from '@/lib/debugLog';
import { queueSnapshot } from './playerLogicUtils';

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
  spotifyHandlePlaylistSelect: (playlistId: string) => Promise<MediaTrack[]>;
  stopRadioBase: () => void;
  radioStateIsActive: boolean;
  record: (ref: CollectionRef, name: string, imageUrl?: string | null) => void;
}

interface UseCollectionLoaderReturn {
  loadCollection: (playlistId: string, provider?: ProviderId, name?: string) => Promise<number>;
  playTracksDirectly: (tracks: MediaTrack[], collectionId: string, provider?: ProviderId) => Promise<number>;
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
  const { setError, setIsLoading, setSelectedPlaylistId, setTracks, setOriginalTracks, setCurrentTrackIndex, mediaTracksRef } = trackOps;

  const beginLoad = useCallback((playlistId: string) => {
    setError(null);
    setIsLoading(true);
    setSelectedPlaylistId(playlistId);
    mediaTracksRef.current = [];
  }, [setError, setIsLoading, setSelectedPlaylistId, mediaTracksRef]);

  const clearWithError = useCallback((message: string): 0 => {
    setError(message);
    setTracks([]);
    setOriginalTracks([]);
    setCurrentTrackIndex(0);
    setIsLoading(false);
    return 0;
  }, [setError, setTracks, setOriginalTracks, setCurrentTrackIndex, setIsLoading]);

  const handleLoadError = useCallback((err: unknown, fallbackMessage: string): 0 => {
    return clearWithError(err instanceof Error ? err.message : fallbackMessage);
  }, [clearWithError]);

  const applyTracks = useCallback((tracks: MediaTrack[], options?: { forceShuffle?: boolean }) => {
    setOriginalTracks(tracks);
    const shouldShuffle = shuffleEnabled || options?.forceShuffle === true;
    if (shouldShuffle) {
      const indices = shuffleArray(tracks.map((_, i) => i));
      const shuffled = indices.map(i => tracks[i]);
      mediaTracksRef.current = shuffled;
      setTracks(shuffled);
    } else {
      mediaTracksRef.current = tracks;
      setTracks(tracks);
    }
    setCurrentTrackIndex(0);
    setIsLoading(false);
  }, [shuffleEnabled, mediaTracksRef, setOriginalTracks, setTracks, setCurrentTrackIndex, setIsLoading]);

  const loadUnifiedLiked = useCallback(async (playlistId: string, name?: string): Promise<number> => {
    beginLoad(playlistId);
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
          return catalog.listTracks({ provider: id, kind: 'liked' }).catch(() => [] as MediaTrack[]);
        }),
      );
      const merged = results.flat();
      merged.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

      if (merged.length === 0) return clearWithError('No liked tracks found.');

      applyTracks(merged);

      const firstTrack = mediaTracksRef.current[0];
      const firstProvider = getDescriptor(firstTrack.provider);
      if (firstProvider) {
        drivingProviderRef.current = firstTrack.provider;
        if (firstTrack.provider !== activeDescriptor?.id) {
          setActiveProviderId(firstTrack.provider);
        }
        queueSnapshot('Unified Liked loaded', merged, mediaTracksRef.current.length, 0);
        await playTrack(0);
        record(
          { provider: firstTrack.provider, kind: 'liked' },
          name ?? LIKED_SONGS_NAME,
          firstTrack.image ?? null,
        );
      }
      return merged.length;
    } catch (err) {
      return handleLoadError(err, 'Failed to load liked tracks.');
    }
  }, [
    beginLoad, clearWithError, handleLoadError, applyTracks,
    connectedProviderIds, getDescriptor, activeDescriptor,
    setActiveProviderId, drivingProviderRef, mediaTracksRef, playTrack, record,
  ]);

  const loadContextPlayback = useCallback(async (
    playlistId: string, providerId: ProviderId,
  ): Promise<number> => {
    setIsLoading(false);
    const prevProvider = drivingProviderRef.current;
    if (prevProvider && prevProvider !== providerId) {
      providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
    }
    drivingProviderRef.current = providerId;
    mediaTracksRef.current = [];
    logQueue('Context playback path — delegating to legacy handler for %s on %s', playlistId, providerId);
    const sdkTracks = await spotifyHandlePlaylistSelect(playlistId);
    if (sdkTracks.length > 0) {
      mediaTracksRef.current = sdkTracks;
      queueSnapshot('Context playback loaded', sdkTracks, mediaTracksRef.current.length, 0);
    } else {
      logQueue('Context playback returned 0 tracks');
    }
    return sdkTracks.length;
  }, [drivingProviderRef, mediaTracksRef, setIsLoading, spotifyHandlePlaylistSelect]);

  const loadProviderCollection = useCallback(async (
    playlistId: string, targetDescriptor: ProviderDescriptor, name?: string,
  ): Promise<number> => {
    const providerId = targetDescriptor.id;

    if (activeDescriptor && activeDescriptor.id !== providerId) {
      activeDescriptor.playback.pause().catch(() => {});
    }

    beginLoad(playlistId);
    try {
      const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, providerId);
      const collectionRef = { provider: providerId, kind: collectionKind, id: collectionId } as const;
      const list = await targetDescriptor.catalog.listTracks(collectionRef);

      if (list.length === 0 && targetDescriptor.playback.playCollection && !shouldUseMockProvider()) {
        return loadContextPlayback(playlistId, providerId);
      }

      if (list.length === 0) return clearWithError('No tracks found in this collection.');

      applyTracks(list, { forceShuffle: isAllMusicRef(collectionRef) });
      drivingProviderRef.current = providerId;
      queueSnapshot(`${providerId} playlist loaded`, list, mediaTracksRef.current.length, 0);
      await playTrack(0);
      record(collectionRef, name ?? collectionId, list[0]?.image ?? null);
      return list.length;
    } catch (err) {
      return handleLoadError(err, 'Failed to load collection.');
    }
  }, [
    activeDescriptor, beginLoad, clearWithError, handleLoadError,
    applyTracks, loadContextPlayback, drivingProviderRef, mediaTracksRef, playTrack, record,
  ]);

  const loadCollection = useCallback(
    async (playlistId: string, provider?: ProviderId, name?: string): Promise<number> => {
      logQueue('loadCollection called — playlistId=%s provider=%s', playlistId, provider ?? 'active');

      if (radioStateIsActive) stopRadioBase();

      if (playlistId === LIKED_SONGS_ID && !provider && isUnifiedLikedActive) {
        return loadUnifiedLiked(playlistId, name);
      }

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (targetProviderId && targetProviderId !== activeDescriptor?.id) {
        setActiveProviderId(targetProviderId);
      }

      if (targetDescriptor) {
        return loadProviderCollection(playlistId, targetDescriptor, name);
      }

      return 0;
    },
    [
      activeDescriptor, getDescriptor, setActiveProviderId,
      isUnifiedLikedActive, loadUnifiedLiked, loadProviderCollection,
      radioStateIsActive, stopRadioBase,
    ]
  );

  const playTracksDirectly = useCallback(
    async (tracks: MediaTrack[], collectionId: string, provider?: ProviderId): Promise<number> => {
      if (radioStateIsActive) stopRadioBase();

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (targetDescriptor && activeDescriptor && activeDescriptor.id !== targetDescriptor.id) {
        activeDescriptor.playback.pause().catch(() => {});
      }

      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(collectionId);
      mediaTracksRef.current = [];

      if (tracks.length === 0) {
        setTracks([]);
        setOriginalTracks([]);
        setCurrentTrackIndex(0);
        setIsLoading(false);
        return 0;
      }

      applyTracks(tracks);

      if (targetProviderId) {
        drivingProviderRef.current = targetProviderId;
        if (targetProviderId !== activeDescriptor?.id) {
          setActiveProviderId(targetProviderId);
        }
      }

      queueSnapshot('Direct tracks loaded', tracks, mediaTracksRef.current.length, 0);
      await playTrack(0);
      return tracks.length;
    },
    [
      radioStateIsActive, stopRadioBase, getDescriptor, activeDescriptor,
      setError, setIsLoading, setSelectedPlaylistId, mediaTracksRef,
      setTracks, setOriginalTracks, setCurrentTrackIndex,
      applyTracks, drivingProviderRef, setActiveProviderId, playTrack,
    ]
  );

  return {
    loadCollection,
    playTracksDirectly,
  };
}
