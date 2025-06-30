import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { AspectRatio } from './ui/aspect-ratio';
import { LoadingIndicator } from './ui/LoadingIndicator';
import { SearchErrorDisplay, type SearchError } from './ui/SearchErrorDisplay';
import { FallbackVideoDisplay } from './ui/FallbackVideoDisplay';

interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
}

interface VideoPlayerProps {
  currentTrack: Track | null;
}

const Container = styled.div`
  width: 100%;
`;

const VideoContainer = styled.div`
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(0.375rem);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  width: 100%;
  height: 100%;
`;

const StyledIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: 0;
`;

const StyledImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RetryOverlay = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 120px;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  
  ${VideoContainer}:hover & {
    opacity: 1;
    pointer-events: auto;
  }
`;

const RetryButton = styled.button`
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #1a1a1a;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: white;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

// Global blacklist for non-embeddable videos (persists across component remounts and page refreshes)
const BLACKLIST_STORAGE_KEY = 'vorbis-player-video-blacklist';

// Load blacklist from localStorage on app start
const loadBlacklist = (): Set<string> => {
  try {
    const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
    if (stored) {
      const array = JSON.parse(stored);
      return new Set(array);
    }
  } catch (error) {
    console.warn('Failed to load video blacklist from localStorage:', error);
  }
  return new Set<string>();
};

// Save blacklist to localStorage
const saveBlacklist = (blacklist: Set<string>): void => {
  try {
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(Array.from(blacklist)));
  } catch (error) {
    console.warn('Failed to save video blacklist to localStorage:', error);
  }
};

const globalVideoBlacklist = loadBlacklist();

const VideoPlayer = memo<VideoPlayerProps>(({ currentTrack }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPhase, setSearchPhase] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);
  const [noEmbeddableVideos, setNoEmbeddableVideos] = useState(false);

  const fetchVideoForTrack = useCallback(async (track: Track) => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setNoEmbeddableVideos(false);
    setSearchPhase('Searching YouTube...');
    try {
      // Search for alternatives, excluding all blacklisted videos
      const blacklistedArray = Array.from(globalVideoBlacklist);
      const searchResult = await videoSearchOrchestrator.findAlternativeVideosWithMetadata(track, blacklistedArray);
      const bestVideo = searchResult.videos.length > 0 ? searchResult.videos[0] : null;
      
      if (!bestVideo) {
        console.log(`No videos found for "${track.name}" by ${track.artists}`);
        
        // Check if this is specifically due to embedding restrictions
        if (searchResult.allFilteredDueToEmbedding) {
          console.log(`⚠️ No embeddable videos available for "${track.name}" - hiding video player`);
          setNoEmbeddableVideos(true);
          setMediaItems([]);
          return;
        }
        
        setError({
          type: 'no_results',
          message: 'No videos found for this track',
          details: `Could not find any suitable videos for "${track.name}" by ${track.artists}`,
          retryable: true
        });
        setMediaItems([]);
        return;
      }
      setMediaItems([{
        id: bestVideo.id,
        type: 'youtube',
        url: youtubeService.createEmbedUrl(bestVideo.id, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: true,
        }),
        title: bestVideo.title,
        thumbnail: bestVideo.thumbnailUrl,
      }]);
      setSearchPhase('');
    } catch (error) {
      setError({
        type: error instanceof Error && error.message.includes('Rate limited') ? 'rate_limit' : 'network_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true
      });
      setMediaItems([]);
    } finally {
      setLoading(false);
      setSearchPhase('');
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (!currentTrack) return;
    
    const currentVideoId = mediaItems[0]?.id;
    
    // Add current video to permanent blacklist
    if (currentVideoId) {
      globalVideoBlacklist.add(currentVideoId);
      saveBlacklist(globalVideoBlacklist); // Persist to localStorage
      console.log(`Blacklisted video ${currentVideoId}. Total blacklisted: ${globalVideoBlacklist.size}`);
    }
    
    setLoading(true);
    setError(null);
    setNoEmbeddableVideos(false);
    setSearchPhase('Finding alternative video...');
    setMediaItems([]); // Clear current video
    
    try {
      // Use findAlternativeVideosWithMetadata to exclude ALL blacklisted videos
      const blacklistedArray = Array.from(globalVideoBlacklist);
      const searchResult = await videoSearchOrchestrator.findAlternativeVideosWithMetadata(
        currentTrack,
        blacklistedArray
      );
      
      if (searchResult.videos.length > 0) {
        const bestAlternative = searchResult.videos[0];
        setMediaItems([{
          id: bestAlternative.id,
          type: 'youtube',
          url: youtubeService.createEmbedUrl(bestAlternative.id, {
            autoplay: true,
            mute: true,
            loop: true,
            controls: true,
          }),
          title: bestAlternative.title,
          thumbnail: bestAlternative.thumbnailUrl,
        }]);
        setSearchPhase('');
      } else {
        // Check if this is specifically due to embedding restrictions
        if (searchResult.allFilteredDueToEmbedding) {
          console.log(`⚠️ No embeddable alternative videos available for "${currentTrack.name}" - hiding video player`);
          setNoEmbeddableVideos(true);
          return;
        }
        
        setError({
          type: 'no_results',
          message: 'No alternative videos found',
          details: `Could not find any other videos for "${currentTrack.name}" by ${currentTrack.artists}`,
          retryable: true
        });
      }
    } catch (error) {
      setError({
        type: 'network_error',
        message: error instanceof Error ? error.message : 'Failed to find alternative video',
        details: error instanceof Error ? error.stack : undefined,
        retryable: true
      });
    } finally {
      setLoading(false);
      setSearchPhase('');
    }
  }, [currentTrack, mediaItems]);

  useEffect(() => {
    if (!currentTrack) return;
    fetchVideoForTrack(currentTrack);
  }, [currentTrack, fetchVideoForTrack]);


  if (!currentTrack) return null;

  // Hide the entire video player if no embeddable videos are available for this track
  if (noEmbeddableVideos && !loading) {
    console.log(`VideoPlayer: Hiding player for "${currentTrack.name}" - no embeddable videos available`);
    return null;
  }

  const currentVideoItem = mediaItems.length > 0 ? mediaItems[0] : null;

  return (
    <Container>
      {loading && (
        <LoadingIndicator 
          variant="search" 
          message={searchPhase || "Searching for videos..."}
          className="py-8"
        />
      )}
      {error && !loading && !noEmbeddableVideos && (
        <SearchErrorDisplay 
          error={error}
          onRetry={() => fetchVideoForTrack(currentTrack)}
          onSkip={() => setError(null)}
        />
      )}
      {mediaItems.length === 0 && !loading && !error && currentTrack && !noEmbeddableVideos && (
        <FallbackVideoDisplay 
          track={currentTrack}
          onSearchRetry={() => fetchVideoForTrack(currentTrack)}
        />
      )}
      {currentVideoItem && (
        <AspectRatio ratio={16 / 9} className="w-full mb-4">
          <VideoContainer>
            {currentVideoItem.type === 'youtube' ? (
              <StyledIframe
                src={currentVideoItem.url}
                title={currentVideoItem.title}
                style={{
                  transform: 'scale(1.0)',
                  transformOrigin: 'center center'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            ) : (
              <StyledImage
                src={currentVideoItem.url}
                alt={currentVideoItem.title}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentVideoItem.title || 'No Image')}`;
                }}
              />
            )}
            <RetryOverlay>
              <RetryButton onClick={handleRetry}>
                🔄 Try Another
              </RetryButton>
            </RetryOverlay>
          </VideoContainer>
        </AspectRatio>
      )}
    </Container>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 