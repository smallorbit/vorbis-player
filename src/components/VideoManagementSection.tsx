import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { videoManagementService } from '../services/videoManagementService';
import type { VideoOption } from '../services/videoManagementService';
import type { TrackVideoAssociation } from '../services/trackVideoAssociationService';
import VideoManagementSettings from './VideoManagementSettings';

interface VideoManagementSectionProps {
  currentTrack: Track | null;
  onVideoChanged?: (association: TrackVideoAssociation | null) => void;
}

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
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
`;

const TrackArtist = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
`;

const VideoCard = styled.div<{ isSelected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid ${props => props.isSelected ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  background: ${props => props.isSelected ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  cursor: ${props => props.isSelected ? 'default' : 'pointer'};
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;

  &:hover {
    background: ${props => props.isSelected ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.1)'};
    border-color: ${props => props.isSelected ? 'rgba(255, 215, 0, 0.7)' : 'rgba(255, 255, 255, 0.2)'};
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const VideoThumbnail = styled.img`
  width: 60px;
  height: 45px;
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
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const VideoMeta = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  display: flex;
  gap: 0.5rem;
  
  span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const VideoActions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.variant === 'danger' ? `
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    
    &:hover {
      background: rgba(239, 68, 68, 0.3);
    }
  ` : `
    background: rgba(255, 215, 0, 0.2);
    color: rgba(255, 215, 0, 0.9);
    
    &:hover {
      background: rgba(255, 215, 0, 0.3);
    }
  `}
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

const SearchButton = styled.button`
  padding: 0.75rem 1.5rem;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 0.5rem;
  color: rgba(255, 215, 0, 0.9);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 1rem;

  &:hover {
    background: rgba(255, 215, 0, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

const ExpandableSection = styled.div`
  margin-top: 1.5rem;
`;

const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: rgba(255, 215, 0, 0.9);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.5rem 0;
  transition: color 0.2s ease;

  &:hover {
    color: rgba(255, 215, 0, 1);
  }

  svg {
    transition: transform 0.2s ease;
  }
`;

const VideoManagementSection = memo(({ currentTrack, onVideoChanged }: VideoManagementSectionProps) => {
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
    if (currentTrack) {
      loadCurrentAssociation();
      searchForVideos();
    }
  }, [currentTrack, loadCurrentAssociation, searchForVideos]);

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

  if (!currentTrack) {
    return (
      <EmptyState>
        No track selected. Please select a track to manage its video association.
      </EmptyState>
    );
  }

  return (
    <div>
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCustomUrl();
            }
          }}
        />
        <SearchButton onClick={handleCustomUrl} disabled={!customUrl.trim()}>
          Add Video
        </SearchButton>
      </Section>

      <Section>
        <SectionTitle>Suggested Videos</SectionTitle>
        <SearchResults>
          {isSearching ? (
            <LoadingText>Searching for videos...</LoadingText>
          ) : searchResults.length > 0 ? (
            searchResults.map((video) => (
              <VideoCard
                key={video.id}
                isSelected={video.isAssociated}
                onClick={() => !video.isAssociated && handleSelectVideo(video)}
              >
                <VideoThumbnail 
                  src={video.thumbnail}
                  alt={video.title}
                />
                <VideoInfo>
                  <VideoTitle>{video.title}</VideoTitle>
                  <VideoMeta>
                    <span>👁 {video.viewCount?.toLocaleString() || 'N/A'}</span>
                    <span>⏱ {video.duration || 'N/A'}</span>
                  </VideoMeta>
                </VideoInfo>
                {video.isAssociated && (
                  <VideoActions>
                    <span style={{ color: 'rgba(255, 215, 0, 0.9)', fontSize: '0.8rem', fontWeight: '500' }}>
                      Selected
                    </span>
                  </VideoActions>
                )}
              </VideoCard>
            ))
          ) : (
            <EmptyState>No suggested videos found</EmptyState>
          )}
        </SearchResults>
      </Section>

      <ExpandableSection>
        <ExpandButton onClick={() => setShowSettings(!showSettings)}>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            style={{ transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
          </svg>
          Advanced Settings
        </ExpandButton>
        
        {showSettings && (
          <VideoManagementSettings />
        )}
      </ExpandableSection>
    </div>
  );
});

VideoManagementSection.displayName = 'VideoManagementSection';

export default VideoManagementSection;