import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import styled from 'styled-components';
import type { LocalTrack, DbAlbum, DbArtist } from '../types/spotify.d.ts';
import { localLibraryDatabase } from '../services/localLibraryDatabaseIPC';
// import { localLibraryScanner } from '../services/localLibraryScannerIPC';
// import { unifiedPlayer } from '../services/unifiedPlayer';
// import { ScrollArea } from './ui/scroll-area';
import { Button } from './styled/Button';
import { Card } from './styled/Card';

const LibraryContainer = styled.div<{ $isDrawerMode?: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.$isDrawerMode ? 'transparent' : 'rgba(255, 255, 255, 0.05)'};
  backdrop-filter: ${props => props.$isDrawerMode ? 'none' : 'blur(20px)'};
  border-radius: ${props => props.$isDrawerMode ? '0' : '16px'};
  border: ${props => props.$isDrawerMode ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'};
  overflow: hidden;
`;

const LibraryHeader = styled.div<{ $isDrawerMode?: boolean }>`
  padding: ${props => props.$isDrawerMode ? '0 20px 16px' : '20px'};
  border-bottom: ${props => props.$isDrawerMode ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'};
  display: ${props => props.$isDrawerMode ? 'none' : 'flex'};
  justify-content: space-between;
  align-items: center;
`;

const LibraryTitle = styled.h2`
  color: white;
  font-size: 24px;
  font-weight: 600;
  margin: 0;
`;

const LibraryStats = styled.div`
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
`;

const ViewSelector = styled.div`
  display: flex;
  gap: 8px;
  margin: 16px 20px;
`;

const ViewButton = styled(Button) <{ active: boolean }>`
  background: ${props => props.active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  color: ${props => props.active ? 'white' : 'rgba(255, 255, 255, 0.7)'};
  border: 1px solid ${props => props.active ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
`;

const SearchContainer = styled.div`
  padding: 0 20px 16px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.15);
  }
`;

const ContentArea = styled.div`
  flex: 1;
  height: 0; /* Allow flex child to shrink below content size */
  min-height: 0; /* Allow flex child to shrink */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
`;

const TrackList = styled.div`
  padding: 0 20px 20px;
`;

const TrackItem = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isSelected', 'accentColor'].includes(prop),
}) <{ isSelected?: boolean; accentColor?: string }>`
  display: grid;
  grid-template-columns: 48px 1fr auto auto;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  align-items: center;
  background: ${props => props.isSelected 
    ? `linear-gradient(90deg, ${props.accentColor}22 0%, transparent 100%)`
    : 'transparent'};
  border-left: 3px solid ${props => props.isSelected ? props.accentColor : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.isSelected 
      ? `linear-gradient(90deg, ${props.accentColor}33 0%, transparent 100%)`
      : 'rgba(255, 255, 255, 0.08)'};
  }
`;

const AlbumThumbnail = styled.div<{ src?: string }>`
  width: 48px;
  height: 48px;
  background: ${props => props.src 
    ? `url(${props.src}) center/cover`
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  border-radius: 4px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.1) 100%);
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TrackNumber = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  text-align: center;
`;

const TrackInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const TrackName = styled.div`
  color: white;
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TrackArtist = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TrackFormat = styled.div<{ format?: string }>`
  color: ${props => {
    switch(props.format?.toLowerCase()) {
      case 'flac': return '#00d4ff';
      case 'wav': return '#ff6b6b';
      case 'mp3': return '#4ecdc4';
      case 'm4a': return '#f7b731';
      case 'ogg': return '#a55eea';
      default: return 'rgba(255, 255, 255, 0.7)';
    }
  }};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 3px 8px;
  background: ${props => {
    switch(props.format?.toLowerCase()) {
      case 'flac': return 'rgba(0, 212, 255, 0.15)';
      case 'wav': return 'rgba(255, 107, 107, 0.15)';
      case 'mp3': return 'rgba(78, 205, 196, 0.15)';
      case 'm4a': return 'rgba(247, 183, 49, 0.15)';
      case 'ogg': return 'rgba(165, 94, 234, 0.15)';
      default: return 'rgba(255, 255, 255, 0.1)';
    }
  }};
  border: 1px solid ${props => {
    switch(props.format?.toLowerCase()) {
      case 'flac': return 'rgba(0, 212, 255, 0.3)';
      case 'wav': return 'rgba(255, 107, 107, 0.3)';
      case 'mp3': return 'rgba(78, 205, 196, 0.3)';
      case 'm4a': return 'rgba(247, 183, 49, 0.3)';
      case 'ogg': return 'rgba(165, 94, 234, 0.3)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
  border-radius: 12px;
  letter-spacing: 0.5px;
`;

const TrackDuration = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
`;

const AlbumGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  padding: 0 20px 20px;
`;

const AlbumCard = styled(Card)`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }
`;

const AlbumArt = styled.div<{ src?: string }>`
  width: 100%;
  aspect-ratio: 1;
  background: ${props => props.src
    ? `url(${props.src}) center/cover`
    : 'linear-gradient(45deg, #333, #555)'
  };
  border-radius: 8px;
  margin-bottom: 12px;
`;

const AlbumName = styled.div`
  color: white;
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlbumArtist = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ArtistList = styled.div`
  padding: 0 20px 20px;
`;

const ArtistItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const ArtistInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const ArtistName = styled.div`
  color: white;
  font-weight: 500;
  font-size: 16px;
`;

const ArtistStats = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
`;

type ViewMode = 'tracks' | 'albums' | 'artists';

interface LocalLibraryBrowserProps {
  onTrackSelect?: (track: LocalTrack) => void;
  onQueueTracks?: (tracks: LocalTrack[], startIndex?: number) => void;
  isDrawerMode?: boolean;
  currentTrackId?: string | null;
  accentColor?: string;
}

// Memoized Track Item Component
const MemoizedTrackItem = memo<{
  track: LocalTrack;
  index: number;
  isSelected: boolean;
  accentColor: string;
  onSelect: (track: LocalTrack, index: number) => void;
}>(({ track, index, isSelected, accentColor, onSelect }) => {
  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const handleClick = useCallback(() => {
    onSelect(track, index);
  }, [track, index, onSelect]);

  return (
    <TrackItem
      isSelected={isSelected}
      accentColor={accentColor}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.name} by ${track.artist} from ${track.album}. Duration: ${formatDuration(track.duration)}. Format: ${track.format}`}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <AlbumThumbnail 
        src={track.albumArt} 
        role="img"
        aria-label={`Album artwork for ${track.album}`}
      />
      <TrackInfo>
        <TrackName>{track.name}</TrackName>
        <TrackArtist>{track.artist} • {track.album}</TrackArtist>
      </TrackInfo>
      <TrackFormat format={track.format}>{track.format}</TrackFormat>
      <TrackDuration>{formatDuration(track.duration)}</TrackDuration>
    </TrackItem>
  );
});

MemoizedTrackItem.displayName = 'MemoizedTrackItem';

// Memoized Album Card Component
const MemoizedAlbumCard = memo<{
  album: DbAlbum;
  onSelect: (album: DbAlbum) => void;
}>(({ album, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(album);
  }, [album, onSelect]);

  return (
    <AlbumCard 
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Play album ${album.name} by ${album.artist}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <AlbumArt 
        src={album.album_art} 
        role="img"
        aria-label={`Album artwork for ${album.name}`}
      />
      <AlbumName>{album.name}</AlbumName>
      <AlbumArtist>{album.artist}</AlbumArtist>
    </AlbumCard>
  );
});

MemoizedAlbumCard.displayName = 'MemoizedAlbumCard';

// Custom comparison function for LocalLibraryBrowser memo optimization
const arePropsEqual = (
  prevProps: LocalLibraryBrowserProps,
  nextProps: LocalLibraryBrowserProps
): boolean => {
  return (
    prevProps.isDrawerMode === nextProps.isDrawerMode &&
    prevProps.currentTrackId === nextProps.currentTrackId &&
    prevProps.accentColor === nextProps.accentColor
  );
};

export const LocalLibraryBrowser: React.FC<LocalLibraryBrowserProps> = memo(({
  onTrackSelect,
  onQueueTracks,
  isDrawerMode = false,
  currentTrackId = null,
  accentColor = '#1db954'
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [albums, setAlbums] = useState<DbAlbum[]>([]);
  const [artists, setArtists] = useState<DbArtist[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTracks: 0,
    totalAlbums: 0,
    totalArtists: 0,
    totalDuration: 0
  });

  console.log('📊 LocalLibraryBrowser current state:', {
    tracksCount: tracks.length,
    albumsCount: albums.length,
    artistsCount: artists.length,
    isLoading,
    stats
  });

  // Debug functions for clearing and rescanning
  const clearAndRescan = useCallback(async () => {
    try {
      console.log('🗑️ Clearing library and rescanning...');
      setIsLoading(true);

      // Clear the library
      await localLibraryDatabase.clearLibrary();

      // Trigger a full rescan using Electron IPC
      await window.electronAPI?.scannerScanDirectories({
        extractArtwork: true,
        parallel: true,
        batchSize: 50
      });

      // Reload data
      await loadData();
      await loadStats();

      console.log('✅ Library cleared and rescanned successfully');
    } catch (error) {
      console.error('Failed to clear and rescan:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  // Load initial data
  useEffect(() => {
    loadData();
    loadStats();

    // Expose debug functions to window
    (window as Record<string, unknown>).debugClearAndRescan = clearAndRescan;
    (window as Record<string, unknown>).debugClearLibrary = () => localLibraryDatabase.clearLibrary();
    (window as Record<string, unknown>).debugLoadData = loadData;
    (window as Record<string, unknown>).debugLoadStats = loadStats;

    return () => {
      // Cleanup debug functions
      delete (window as Record<string, unknown>).debugClearAndRescan;
      delete (window as Record<string, unknown>).debugClearLibrary;
      delete (window as Record<string, unknown>).debugLoadData;
      delete (window as Record<string, unknown>).debugLoadStats;
    };
  }, [clearAndRescan]);

  const loadData = async () => {
    setIsLoading(true);
    console.log('🔄 LocalLibraryBrowser: Loading data...');
    try {
      const [tracksData, albumsData, artistsData] = await Promise.all([
        localLibraryDatabase.getAllTracks(),
        localLibraryDatabase.getAllAlbums(),
        localLibraryDatabase.getAllArtists()
      ]);

      console.log('📊 LocalLibraryBrowser: Received data:', {
        tracksCount: tracksData.length,
        albumsCount: albumsData.length,
        artistsCount: artistsData.length
      });

      if (tracksData.length > 0) {
        console.log('🎵 Sample tracks with formats:', tracksData.slice(0, 5).map(track => ({
          name: track.name,
          format: track.format,
          filePath: track.filePath,
          fileSize: track.fileSize
        })));
      }

      setTracks(tracksData);
      setAlbums(albumsData);
      setArtists(artistsData);
    } catch (error) {
      console.error('Failed to load library data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await localLibraryDatabase.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load library stats:', error);
    }
  };

  // Filter data based on search query
  const filteredTracks = useMemo(() => {
    if (!searchQuery) return tracks;

    const query = searchQuery.toLowerCase();
    return tracks.filter(track =>
      track.name.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.album.toLowerCase().includes(query) ||
      track.genre?.toLowerCase().includes(query)
    );
  }, [tracks, searchQuery]);

  const filteredAlbums = useMemo(() => {
    if (!searchQuery) return albums;

    const query = searchQuery.toLowerCase();
    return albums.filter(album =>
      album.name.toLowerCase().includes(query) ||
      album.artist.toLowerCase().includes(query)
    );
  }, [albums, searchQuery]);

  const filteredArtists = useMemo(() => {
    if (!searchQuery) return artists;

    const query = searchQuery.toLowerCase();
    return artists.filter(artist =>
      artist.name.toLowerCase().includes(query)
    );
  }, [artists, searchQuery]);

  const handleTrackClick = useCallback(async (track: LocalTrack, index: number) => {
    console.log('🎵 Track clicked:', { trackName: track.name, index, trackId: track.id });
    setSelectedTrackId(track.id);

    if (onTrackSelect) {
      onTrackSelect(track);
    }

    if (onQueueTracks) {
      console.log('📋 Queueing tracks with startIndex:', index);
      onQueueTracks(filteredTracks, index);
    }
  }, [filteredTracks, onTrackSelect, onQueueTracks]);

  const handleAlbumClick = useCallback(async (album: DbAlbum) => {
    try {
      const albumTracks = await localLibraryDatabase.getTracksByAlbum(album.name, album.artist);
      if (albumTracks.length > 0 && onQueueTracks) {
        onQueueTracks(albumTracks, 0);
      }
    } catch (error) {
      console.error('Failed to load album tracks:', error);
    }
  }, [onQueueTracks]);

  const handleArtistClick = useCallback(async (artist: DbArtist) => {
    try {
      const artistTracks = await localLibraryDatabase.getTracksByArtist(artist.name);
      if (artistTracks.length > 0 && onQueueTracks) {
        onQueueTracks(artistTracks, 0);
      }
    } catch (error) {
      console.error('Failed to load artist tracks:', error);
    }
  }, [onQueueTracks]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const renderTracksView = () => {
    console.log(`🎵 Rendering tracks view with ${filteredTracks.length} tracks`);
    return (
      <TrackList>
        {filteredTracks.length === 0 ? (
          <EmptyState>
            <div>No tracks found</div>
            {searchQuery && <div>Try adjusting your search terms</div>}
          </EmptyState>
        ) : (
          <>
            <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px' }}>
              Showing {filteredTracks.length} tracks
            </div>
            {filteredTracks.map((track, index) => (
              <MemoizedTrackItem
                key={track.id}
                track={track}
                index={index}
                isSelected={currentTrackId ? track.id === currentTrackId : track.id === selectedTrackId}
                accentColor={accentColor}
                onSelect={handleTrackClick}
              />
            ))}
          </>
        )}
      </TrackList>
    );
  };

  const renderAlbumsView = () => (
    <AlbumGrid>
      {filteredAlbums.length === 0 ? (
        <EmptyState>
          <div>No albums found</div>
          {searchQuery && <div>Try adjusting your search terms</div>}
        </EmptyState>
      ) : (
        filteredAlbums.map((album) => (
          <MemoizedAlbumCard 
            key={album.id} 
            album={album}
            onSelect={handleAlbumClick}
          />
        ))
      )}
    </AlbumGrid>
  );

  const renderArtistsView = () => (
    <ArtistList>
      {filteredArtists.length === 0 ? (
        <EmptyState>
          <div>No artists found</div>
          {searchQuery && <div>Try adjusting your search terms</div>}
        </EmptyState>
      ) : (
        filteredArtists.map((artist) => (
          <ArtistItem key={artist.id} onClick={() => handleArtistClick(artist)}>
            <ArtistInfo>
              <ArtistName>{artist.name}</ArtistName>
              <ArtistStats>
                {artist.album_count} albums • {artist.track_count} tracks
              </ArtistStats>
            </ArtistInfo>
          </ArtistItem>
        ))
      )}
    </ArtistList>
  );

  return (
    <LibraryContainer $isDrawerMode={isDrawerMode}>
      <LibraryHeader $isDrawerMode={isDrawerMode}>
        <LibraryTitle>Local Music Library</LibraryTitle>
        <LibraryStats>
          <div>{stats.totalTracks} tracks</div>
          <div>{stats.totalAlbums} albums</div>
          <div>{stats.totalArtists} artists</div>
          <div>{formatTotalDuration(stats.totalDuration)}</div>
        </LibraryStats>
      </LibraryHeader>

      <ViewSelector role="tablist" aria-label="View selection">
        <ViewButton
          active={viewMode === 'tracks'}
          onClick={() => setViewMode('tracks')}
          role="tab"
          aria-selected={viewMode === 'tracks'}
          aria-controls="library-content"
        >
          Tracks
        </ViewButton>
        <ViewButton
          active={viewMode === 'albums'}
          onClick={() => setViewMode('albums')}
          role="tab"
          aria-selected={viewMode === 'albums'}
          aria-controls="library-content"
        >
          Albums
        </ViewButton>
        <ViewButton
          active={viewMode === 'artists'}
          onClick={() => setViewMode('artists')}
          role="tab"
          aria-selected={viewMode === 'artists'}
          aria-controls="library-content"
        >
          Artists
        </ViewButton>
        <ViewButton
          active={false}
          onClick={() => {
            console.log('🔄 Manual refresh requested');
            loadData();
            loadStats();
          }}
          aria-label="Refresh library data"
        >
          🔄 Refresh
        </ViewButton>
      </ViewSelector>

      <SearchContainer role="search">
        <SearchInput
          type="text"
          placeholder={`Search ${viewMode}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={`Search ${viewMode} in your local library`}
          aria-describedby="search-description"
        />
        <div id="search-description" style={{ display: 'none' }}>
          Type to search through your {viewMode}. Results will filter automatically as you type.
        </div>
      </SearchContainer>

      <ContentArea 
        id="library-content" 
        role="tabpanel" 
        aria-label={`${viewMode} view`}
        aria-live="polite"
      >
        {viewMode === 'tracks' && renderTracksView()}
        {viewMode === 'albums' && renderAlbumsView()}
        {viewMode === 'artists' && renderArtistsView()}
      </ContentArea>
    </LibraryContainer>
  );
}, arePropsEqual);

LocalLibraryBrowser.displayName = 'LocalLibraryBrowser';

export default LocalLibraryBrowser;