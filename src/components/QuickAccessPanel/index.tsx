import React, { useState, useMemo } from 'react';
import type { PlaylistInfo, AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { usePinnedItemsContext } from '@/contexts/PinnedItemsContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import { Chip, ChipRow } from '@/components/styled/FilterChips';
import ProviderIcon from '@/components/ProviderIcon';
import ResumeCard from './ResumeCard';
import PinRing from './PinRing';
import {
  PanelRoot,
  ChipsSection,
  BrowseSection,
  BrowseButton,
} from './styled';

export interface QuickAccessPanelProps {
  onPlaylistSelect: (id: string, name: string, provider?: ProviderId) => void;
  onAddToQueue: (id: string, name?: string, provider?: ProviderId) => void;
  onBrowseLibrary: () => void;
  lastSession: SessionSnapshot | null;
  onResume: () => void;
}

const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  onPlaylistSelect,
  onAddToQueue,
  onBrowseLibrary,
  lastSession,
  onResume,
}) => {
  const { pinnedPlaylistIds, pinnedAlbumIds } = usePinnedItemsContext();
  const { connectedProviderIds, getDescriptor } = useProviderContext();
  const { playlists, albums, likedSongsCount, likedSongsPerProvider } = useLibrarySync();
  const { isUnifiedLikedActive, totalCount: unifiedLikedCount } = useUnifiedLikedTracks();

  const [activeProviderIds, setActiveProviderIds] = useState<ProviderId[]>([]);

  const toggleProvider = (id: ProviderId) => {
    setActiveProviderIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }
      return [...prev, id];
    });
  };

  const filteredProviders = activeProviderIds.length > 0 ? activeProviderIds : connectedProviderIds;

  const pinnedPlaylists = useMemo<PlaylistInfo[]>(() => {
    const idSet = new Set(pinnedPlaylistIds);
    return playlists
      .filter(p => idSet.has(p.id))
      .sort((a, b) => pinnedPlaylistIds.indexOf(a.id) - pinnedPlaylistIds.indexOf(b.id));
  }, [playlists, pinnedPlaylistIds]);

  const pinnedAlbums = useMemo<AlbumInfo[]>(() => {
    const idSet = new Set(pinnedAlbumIds);
    return albums
      .filter(a => idSet.has(a.id))
      .sort((a, b) => pinnedAlbumIds.indexOf(a.id) - pinnedAlbumIds.indexOf(b.id));
  }, [albums, pinnedAlbumIds]);

  const effectiveLikedCount = isUnifiedLikedActive ? unifiedLikedCount : likedSongsCount;

  const handleLoadCollection = (id: string, name: string, provider?: ProviderId) => {
    onPlaylistSelect(id, name, provider);
  };

  const handleLoadLikedSongs = (providerIds: ProviderId[]) => {
    const perProvider = likedSongsPerProvider.filter(e =>
      providerIds.length === 0 || providerIds.includes(e.provider),
    );
    const resolvedProvider = perProvider.length === 1 ? perProvider[0].provider : undefined;
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, resolvedProvider);
  };

  const showProviderChips = connectedProviderIds.length > 1;

  return (
    <PanelRoot>
      <PinRing
        pinnedPlaylists={pinnedPlaylists}
        pinnedAlbums={pinnedAlbums}
        activeProviderIds={filteredProviders}
        likedSongsCount={effectiveLikedCount}
        onLoadCollection={handleLoadCollection}
        onLoadLikedSongs={handleLoadLikedSongs}
        onAddToQueue={onAddToQueue}
      />

      {showProviderChips && (
        <ChipsSection>
          <ChipRow>
            {connectedProviderIds.map(id => {
              const descriptor = getDescriptor(id);
              if (!descriptor) return null;
              const isActive = activeProviderIds.length === 0 || activeProviderIds.includes(id);
              return (
                <Chip
                  key={id}
                  $active={isActive}
                  onClick={() => toggleProvider(id)}
                  aria-pressed={isActive}
                >
                  <ProviderIcon provider={id} size={14} />
                  {descriptor.name}
                </Chip>
              );
            })}
          </ChipRow>
        </ChipsSection>
      )}

      <BrowseSection>
        <BrowseButton onClick={onBrowseLibrary}>
          Browse Library →
        </BrowseButton>
      </BrowseSection>

      {lastSession && lastSession.collectionId && (
        <ResumeCard session={lastSession} onResume={onResume} />
      )}
    </PanelRoot>
  );
};

export default QuickAccessPanel;
