import React, { useState, useMemo } from 'react';
import type { CollectionSelection, MediaCollection, ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { usePinnedItemsContext } from '@/contexts/PinnedItemsContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { LIKED_SONGS_NAME } from '@/constants/playlist';
import { Chip, ChipRow } from '@/components/styled/FilterChips';
import ProviderIcon from '@/components/ProviderIcon';
import ResumeHero from './ResumeHero';
import PinRing from './PinRing';
import {
  PanelRoot,
  ChipsSection,
  BrowseSection,
  BrowseButton,
} from './styled';

interface QuickAccessPanelProps {
  onSelectCollection: (selection: CollectionSelection) => void;
  onAddToQueue: (selection: CollectionSelection) => void;
  onBrowseLibrary: () => void;
  lastSession: SessionSnapshot | null;
  onResume: () => void;
}

const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  onSelectCollection,
  onAddToQueue,
  onBrowseLibrary,
  lastSession,
  onResume,
}) => {
  const { pinnedPlaylistIds, pinnedAlbumIds } = usePinnedItemsContext();
  const { connectedProviderIds, getDescriptor } = useProviderContext();
  const { playlists, albums, likedSongsPerProvider } = useLibrarySync();
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

  const pinnedPlaylists = useMemo<MediaCollection[]>(() => {
    const idSet = new Set(pinnedPlaylistIds);
    return playlists
      .filter(p => idSet.has(p.id))
      .sort((a, b) => pinnedPlaylistIds.indexOf(a.id) - pinnedPlaylistIds.indexOf(b.id));
  }, [playlists, pinnedPlaylistIds]);

  const pinnedAlbums = useMemo<MediaCollection[]>(() => {
    const idSet = new Set(pinnedAlbumIds);
    return albums
      .filter(a => idSet.has(a.id))
      .sort((a, b) => pinnedAlbumIds.indexOf(a.id) - pinnedAlbumIds.indexOf(b.id));
  }, [albums, pinnedAlbumIds]);

  const filteredLikedSongsPerProvider = activeProviderIds.length > 0
    ? likedSongsPerProvider.filter(e => activeProviderIds.includes(e.provider))
    : likedSongsPerProvider;

  const shouldShowUnified = isUnifiedLikedActive && filteredLikedSongsPerProvider.length !== 1;
  const effectiveLikedCount = shouldShowUnified
    ? unifiedLikedCount
    : filteredLikedSongsPerProvider.reduce((sum, e) => sum + e.count, 0);

  const handleLoadLikedSongs = (providerIds: ProviderId[]) => {
    const perProvider = likedSongsPerProvider.filter(e =>
      providerIds.length === 0 || providerIds.includes(e.provider),
    );
    const resolvedProvider = perProvider.length === 1 ? perProvider[0]?.provider : undefined;
    onSelectCollection({
      type: 'liked',
      name: LIKED_SONGS_NAME,
      ...(resolvedProvider !== undefined && { provider: resolvedProvider }),
    });
  };

  const showProviderChips = connectedProviderIds.length > 1;
  const hasValidSession = Boolean(lastSession && lastSession.selection);

  return (
    <PanelRoot>
      {hasValidSession && lastSession && (
        <ResumeHero session={lastSession} onResume={onResume} />
      )}

      <PinRing
        pinnedPlaylists={pinnedPlaylists}
        pinnedAlbums={pinnedAlbums}
        activeProviderIds={filteredProviders}
        likedSongsCount={effectiveLikedCount}
        onLoadCollection={onSelectCollection}
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
    </PanelRoot>
  );
};

export default QuickAccessPanel;
