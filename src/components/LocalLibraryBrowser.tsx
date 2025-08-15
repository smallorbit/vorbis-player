import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import type { LocalTrack, DbAlbum, DbArtist } from '../types/spotify.d.ts';
import { localLibraryDatabase } from '../services/localLibraryDatabaseIPC';
import { localLibraryScanner } from '../services/localLibraryScannerIPC';
import { unifiedPlayer } from '../services/unifiedPlayer';
// import { ScrollArea } from './ui/scroll-area';
import { Button } from './styled/Button';
import { Card } from './styled/Card';

const LibraryContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const LibraryHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
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
  shouldForwardProp: (prop) => !['isSelected'].includes(prop),
}) <{ isSelected?: boolean }>`
  display: grid;
  grid-template-columns: 40px 1fr auto auto;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  align-items: center;
  background: ${props => props.isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

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

const TrackFormat = styled.div`
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-transform: uppercase;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
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
}

export const LocalLibraryBrowser: React.FC<LocalLibraryBrowserProps> = ({
  onTrackSelect,
  onQueueTracks
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

  // Load initial data
  useEffect(() => {
    loadData();
    loadStats();
  }, []);

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
    setSelectedTrackId(track.id);

    if (onTrackSelect) {
      onTrackSelect(track);
    }

    if (onQueueTracks) {
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
              <TrackItem
                key={track.id}
                isSelected={track.id === selectedTrackId}
                onClick={() => handleTrackClick(track, index)}
              >
                <TrackNumber>
                  {track.trackNumber || index + 1}
                </TrackNumber>
                <TrackInfo>
                  <TrackName>{track.name}</TrackName>
                  <TrackArtist>{track.artist} • {track.album}</TrackArtist>
                </TrackInfo>
                <TrackFormat>{track.format}</TrackFormat>
                <TrackDuration>{formatDuration(track.duration)}</TrackDuration>
              </TrackItem>
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
          <AlbumCard key={album.id} onClick={() => handleAlbumClick(album)}>
            <AlbumArt src={album.album_art} />
            <AlbumName>{album.name}</AlbumName>
            <AlbumArtist>{album.artist}</AlbumArtist>
          </AlbumCard>
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
    <LibraryContainer>
      <LibraryHeader>
        <LibraryTitle>Local Music Library</LibraryTitle>
        <LibraryStats>
          <div>{stats.totalTracks} tracks</div>
          <div>{stats.totalAlbums} albums</div>
          <div>{stats.totalArtists} artists</div>
          <div>{formatTotalDuration(stats.totalDuration)}</div>
        </LibraryStats>
      </LibraryHeader>

      <ViewSelector>
        <ViewButton
          active={viewMode === 'tracks'}
          onClick={() => setViewMode('tracks')}
        >
          Tracks
        </ViewButton>
        <ViewButton
          active={viewMode === 'albums'}
          onClick={() => setViewMode('albums')}
        >
          Albums
        </ViewButton>
        <ViewButton
          active={viewMode === 'artists'}
          onClick={() => setViewMode('artists')}
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
        >
          🔄 Refresh
        </ViewButton>
      </ViewSelector>

      <SearchContainer>
        <SearchInput
          type="text"
          placeholder={`Search ${viewMode}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </SearchContainer>

      <ContentArea>
        {viewMode === 'tracks' && renderTracksView()}
        {viewMode === 'albums' && renderAlbumsView()}
        {viewMode === 'artists' && renderArtistsView()}
      </ContentArea>
    </LibraryContainer>
  );
};

export default LocalLibraryBrowser;