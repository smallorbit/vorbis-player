import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { videoManagementService } from '../services/videoManagementService';
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
    setSearchPhase('Checking saved videos...');
    
    try {
      // First check if we have a saved association for this track
      const savedAssociation = await videoManagementService.getVideoForTrack(track);
      
      if (savedAssociation) {
        setMediaItems([{
          id: savedAssociation.videoId,
          type: 'youtube',
          url: youtubeService.createEmbedUrl(savedAssociation.videoId, {
            autoplay: true,
            mute: true,
            loop: true,
            controls: true,
          }),
          title: savedAssociation.videoTitle,
          thumbnail: savedAssociation.videoThumbnail,
        }]);
        setSearchPhase('');
        setLoading(false);
        return;
      }
      
      // If no saved association, fall back to search
      setSearchPhase('Searching YouTube...');
      const blacklistedArray = Array.from(globalVideoBlacklist);
      const searchResults = await videoSearchOrchestrator.findAlternativeVideos(track, blacklistedArray);
      const bestVideo = searchResults.length > 0 ? searchResults[0] : null;
      
      if (!bestVideo) {
        console.log(`No videos found for "${track.name}" by ${track.artists}`);
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
          </VideoContainer>
        </AspectRatio>
      )}
    </Container>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 