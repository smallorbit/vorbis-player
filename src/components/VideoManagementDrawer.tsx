import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { videoManagementService } from '../services/videoManagementService';
import type { VideoOption } from '../services/videoManagementService';
import type { TrackVideoAssociation } from '../services/trackVideoAssociationService';
import VideoManagementSettings from './VideoManagementSettings';

interface VideoManagementDrawerProps {
  currentTrack: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onVideoChanged?: (association: TrackVideoAssociation | null) => void;
}

const DrawerOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 999;
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s ease;
`;

const Drawer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 500px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow-y: auto;
  padding: 1.5rem;
  box-sizing: border-box;
  
  @media (max-width: 600px) {
    width: 100vw;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  margin: 0;
  color: white;
  font-size: 1.3rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h3`
  color: rgba(255, 215, 0, 0.9);
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
`;

const TrackInfo = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
`;

const TrackTitle = styled.div`
  color: white;
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const TrackArtist = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
`;

const VideoCard = styled.div<{ isSelected?: boolean }>`
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: ${props => props.isSelected ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.isSelected ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.75rem;

  &:hover {
    background: ${props => props.isSelected ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

const VideoThumbnail = styled.img`
  width: 120px;
  height: 68px;
  object-fit: cover;
  border-radius: 0.25rem;
  flex-shrink: 0;
`;

const VideoInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const VideoTitle = styled.div`
  color: white;
  font-weight: 500;
  margin-bottom: 0.25rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.9rem;
  line-height: 1.3;
`;

const VideoMeta = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const VideoActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-end;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' | 'secondary' }>`
  background: ${props => 
    props.variant === 'primary' ? 'rgba(255, 215, 0, 0.8)' :
    props.variant === 'danger' ? 'rgba(255, 0, 0, 0.8)' :
    'rgba(255, 255, 255, 0.1)'
  };
  color: ${props => props.variant === 'primary' ? 'black' : 'white'};
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  color: white;
  font-size: 1rem;
  margin-bottom: 1rem;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  &:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.5);
  }
`;

const SearchResults = styled.div`
  max-height: 300px;
  overflow-y: auto;
`;

const LoadingText = styled.div`
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  padding: 2rem;
`;

const EmptyState = styled.div`
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: 2rem;
  font-style: italic;
`;

const VideoManagementDrawer = memo(({ currentTrack, isOpen, onClose, onVideoChanged }: VideoManagementDrawerProps) => {
  const [currentAssociation, setCurrentAssociation] = useState<TrackVideoAssociation | null>(null);
  const [searchResults, setSearchResults] = useState<VideoOption[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadCurrentAssociation = useCallback(async () => {
    if (!currentTrack) return;
    
    setIsLoading(true);
    try {
      const association = await videoManagementService.getVideoForTrack(currentTrack);
      setCurrentAssociation(association);
    } catch (error) {
      console.error('Failed to load current association:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTrack]);

  const searchForVideos = useCallback(async () => {
    if (!currentTrack) return;
    
    setIsSearching(true);
    try {
      const results = await videoManagementService.searchVideosForTrack(currentTrack, 10);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search for videos:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isOpen && currentTrack) {
      loadCurrentAssociation();
      searchForVideos();
    }
  }, [isOpen, currentTrack, loadCurrentAssociation, searchForVideos]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSelectVideo = async (video: VideoOption) => {
    if (!currentTrack) return;
    
    try {
      const result = await videoManagementService.setVideoForTrack(
        currentTrack,
        video.id,
        video.title,
        video.thumbnail
      );
      
      if (result.success) {
        setCurrentAssociation(result.video || null);
        onVideoChanged?.(result.video || null);
        // Update search results to reflect selection
        setSearchResults(prev => prev.map(v => ({
          ...v,
          isAssociated: v.id === video.id
        })));
      }
    } catch (error) {
      console.error('Failed to select video:', error);
    }
  };

  const handleRemoveAssociation = async () => {
    if (!currentTrack) return;
    
    try {
      const result = videoManagementService.removeVideoForTrack(currentTrack);
      if (result.success) {
        setCurrentAssociation(null);
        onVideoChanged?.(null);
        // Update search results
        setSearchResults(prev => prev.map(v => ({
          ...v,
          isAssociated: false
        })));
      }
    } catch (error) {
      console.error('Failed to remove association:', error);
    }
  };

  const handleCustomUrl = async () => {
    if (!currentTrack || !customUrl.trim()) return;
    
    const validation = videoManagementService.validateYouTubeUrl(customUrl.trim());
    if (!validation.valid || !validation.videoId) {
      alert('Please enter a valid YouTube URL or video ID');
      return;
    }
    
    try {
      const result = await videoManagementService.setVideoForTrack(
        currentTrack,
        validation.videoId,
        `Custom video for ${currentTrack.name}`
      );
      
      if (result.success) {
        setCurrentAssociation(result.video || null);
        onVideoChanged?.(result.video || null);
        setCustomUrl('');
        // Refresh search results
        searchForVideos();
      }
    } catch (error) {
      console.error('Failed to set custom video:', error);
    }
  };

  if (!currentTrack) return null;

  return (
    <>
      <DrawerOverlay isOpen={isOpen} onClick={onClose} />
      <Drawer isOpen={isOpen}>
        <Header>
          <Title>Video Management</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>

        <TrackInfo>
          <TrackTitle>{currentTrack.name}</TrackTitle>
          <TrackArtist>{currentTrack.artists}</TrackArtist>
        </TrackInfo>

        <Section>
          <SectionTitle>Current Video</SectionTitle>
          {isLoading ? (
            <LoadingText>Loading current video...</LoadingText>
          ) : currentAssociation ? (
            <VideoCard isSelected>
              <VideoThumbnail 
                src={currentAssociation.videoThumbnail || `https://img.youtube.com/vi/${currentAssociation.videoId}/mqdefault.jpg`}
                alt={currentAssociation.videoTitle}
                onError={(e) => {
                  e.currentTarget.src = `https://img.youtube.com/vi/${currentAssociation.videoId}/mqdefault.jpg`;
                }}
              />
              <VideoInfo>
                <VideoTitle>{currentAssociation.videoTitle}</VideoTitle>
                <VideoMeta>
                  <span>{currentAssociation.isUserSet ? 'Manual' : 'Auto-discovered'}</span>
                  <span>{new Date(currentAssociation.dateAssociated).toLocaleDateString()}</span>
                </VideoMeta>
              </VideoInfo>
              <VideoActions>
                <ActionButton variant="danger" onClick={handleRemoveAssociation}>
                  Remove
                </ActionButton>
              </VideoActions>
            </VideoCard>
          ) : (
            <EmptyState>No video currently associated with this track</EmptyState>
          )}
        </Section>

        <Section>
          <SectionTitle>Add Custom Video</SectionTitle>
          <SearchInput
            type="text"
            placeholder="Enter YouTube URL or video ID..."
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCustomUrl()}
          />
          <ActionButton variant="primary" onClick={handleCustomUrl} disabled={!customUrl.trim()}>
            Add Video
          </ActionButton>
        </Section>

        <Section>
          <SectionTitle>Suggested Videos</SectionTitle>
          {isSearching ? (
            <LoadingText>Finding videos...</LoadingText>
          ) : (
            <SearchResults>
              {searchResults.length > 0 ? (
                searchResults.map((video) => (
                  <VideoCard
                    key={video.id}
                    isSelected={video.isAssociated}
                    onClick={() => handleSelectVideo(video)}
                  >
                    <VideoThumbnail 
                      src={video.thumbnail}
                      alt={video.title}
                    />
                    <VideoInfo>
                      <VideoTitle>{video.title}</VideoTitle>
                      <VideoMeta>
                        {video.duration && <span>{video.duration}</span>}
                        {video.views && <span>{video.views} views</span>}
                      </VideoMeta>
                    </VideoInfo>
                    <VideoActions>
                      <ActionButton variant={video.isAssociated ? "secondary" : "primary"}>
                        {video.isAssociated ? 'Selected' : 'Select'}
                      </ActionButton>
                    </VideoActions>
                  </VideoCard>
                ))
              ) : (
                <EmptyState>No videos found</EmptyState>
              )}
            </SearchResults>
          )}
        </Section>

        <Section>
          <SectionTitle>Settings</SectionTitle>
          <ActionButton 
            variant="secondary" 
            onClick={() => setShowSettings(!showSettings)}
            style={{ marginBottom: '1rem' }}
          >
            {showSettings ? 'Hide Settings' : 'Show Settings'}
          </ActionButton>
          {showSettings && <VideoManagementSettings />}
        </Section>
      </Drawer>
    </>
  );
});

VideoManagementDrawer.displayName = 'VideoManagementDrawer';

export default VideoManagementDrawer;