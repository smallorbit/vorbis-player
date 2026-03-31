import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { LIKED_SONGS_ID, resolvePlaylistRef } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';
import { queueSnapshot } from './playerLogicUtils';

interface UseCollectionLoaderProps {
  activeDescriptor: ProviderDescriptor | undefined;
  getDescriptor: (providerId: ProviderId) => ProviderDescriptor | undefined;
  setActiveProviderId: (providerId: ProviderId) => void;
  connectedProviderIds: ProviderId[];
  shuffleEnabled: boolean;
  isUnifiedLikedActive: boolean;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  drivingProviderRef: React.MutableRefObject<ProviderId | null>;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[]) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  playTrack: (index: number, isSkip?: boolean) => Promise<void>;
  spotifyHandlePlaylistSelect: (playlistId: string) => Promise<MediaTrack[]>;
  stopRadioBase: () => void;
  radioStateIsActive: boolean;
}

interface UseCollectionLoaderReturn {
  handlePlaylistSelect: (playlistId: string, _playlistName?: string, provider?: ProviderId) => Promise<number>;
}

export function useCollectionLoader({
  activeDescriptor,
  getDescriptor,
  setActiveProviderId,
  connectedProviderIds,
  shuffleEnabled,
  isUnifiedLikedActive,
  mediaTracksRef,
  drivingProviderRef,
  setError,
  setIsLoading,
  setSelectedPlaylistId,
  setTracks,
  setOriginalTracks,
  setCurrentTrackIndex,
  playTrack,
  spotifyHandlePlaylistSelect,
  stopRadioBase,
  radioStateIsActive,
}: UseCollectionLoaderProps): UseCollectionLoaderReturn {
  const handlePlaylistSelect = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: ProviderId): Promise<number> => {
      logQueue('handlePlaylistSelect called — playlistId=%s provider=%s', playlistId, provider ?? 'active');

      if (radioStateIsActive) {
        stopRadioBase();
      }

      // Unified liked songs: fetch from all connected providers, merge by timestamp
      if (playlistId === LIKED_SONGS_ID && !provider && isUnifiedLikedActive) {
        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
        try {
          // Cache descriptors to avoid redundant lookups
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

          if (merged.length === 0) {
            setError('No liked tracks found.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return 0;
          }

          setOriginalTracks(merged);
          if (shuffleEnabled) {
            const indices = shuffleArray(merged.map((_, i) => i));
            const shuffled = indices.map(i => merged[i]);
            mediaTracksRef.current = shuffled;
            setTracks(shuffled);
          } else {
            mediaTracksRef.current = merged;
            setTracks(merged);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);

          const firstTrack = mediaTracksRef.current[0];
          const firstProvider = getDescriptor(firstTrack.provider);
          if (firstProvider) {
            drivingProviderRef.current = firstTrack.provider;
            if (firstTrack.provider !== activeDescriptor?.id) {
              setActiveProviderId(firstTrack.provider);
            }
            queueSnapshot('Unified Liked loaded', merged, mediaTracksRef.current.length, 0);
            // Route initial playback through shared playTrack() so Spotify queue sync runs immediately.
            await playTrack(0);
          }
          return merged.length;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load liked tracks.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
          return 0;
        }
      }

      // Determine which provider descriptor to use for this collection
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      // If selecting from a different provider, switch active provider for playback
      if (targetProviderId && targetProviderId !== activeDescriptor?.id) {
        setActiveProviderId(targetProviderId);
      }

      if (targetDescriptor) {
        const providerId = targetDescriptor.id;

        // Pause the previous provider before switching (activeDescriptor may still
        // point to the old provider since setActiveProviderId is async via React state)
        if (activeDescriptor && activeDescriptor.id !== providerId) {
          activeDescriptor.playback.pause().catch(() => {});
        }

        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
        try {
          const catalog = targetDescriptor.catalog;
          const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, providerId);
          const collectionRef = { provider: providerId, kind: collectionKind, id: collectionId } as const;
          const list = await catalog.listTracks(collectionRef);

          // If catalog returns no tracks and the provider supports native collection
          // playback (e.g. Spotify context playback for restricted playlists), delegate
          // to the legacy SDK-based playlist handler.
          if (list.length === 0 && targetDescriptor.playback.playCollection) {
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
          }

          if (list.length === 0) {
            setError('No tracks found in this collection.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return 0;
          }
          setOriginalTracks(list);
          if (shuffleEnabled) {
            const indices = shuffleArray<number>(list.map((_: MediaTrack, i: number) => i));
            const shuffled = indices.map(i => list[i]);
            mediaTracksRef.current = shuffled;
            setTracks(shuffled);
          } else {
            mediaTracksRef.current = list;
            setTracks(list);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);
          drivingProviderRef.current = providerId;
          queueSnapshot(`${providerId} playlist loaded`, list, mediaTracksRef.current.length, 0);
          await playTrack(0);
          return list.length;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load collection.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
          return 0;
        }
      }
      return 0;
    },
    [
      activeDescriptor,
      getDescriptor,
      setActiveProviderId,
      shuffleEnabled,
      setError,
      setIsLoading,
      setSelectedPlaylistId,
      setTracks,
      setOriginalTracks,
      setCurrentTrackIndex,
      spotifyHandlePlaylistSelect,
      isUnifiedLikedActive,
      connectedProviderIds,
      drivingProviderRef,
      playTrack,
      radioStateIsActive,
      stopRadioBase,
    ]
  );

  return {
    handlePlaylistSelect,
  };
}
