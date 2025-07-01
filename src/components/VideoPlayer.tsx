import { useState, useEffect, memo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';
import { videoManagementService } from '../services/videoManagementService';
import { AspectRatio } from './ui/aspect-ratio';
import { SearchErrorDisplay, type SearchError } from './ui/SearchErrorDisplay';

interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
}

interface VideoPlayerProps {
  currentTrack: Track | null;
  showVideo?: boolean;
}

const Container = styled.div`
  width: 100%;
  position: relative;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  border-radius: 1rem;
  z-index: 10;
`;

const Spinner = styled.div`
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const VideoContainer = styled.div<{ isPlaceholder?: boolean }>`
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  ${({ isPlaceholder }) => isPlaceholder ? `
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
  ` : `
    background-color: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(0.375rem);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
  `}
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

const PlaceholderContainer = styled.div<{ backgroundImage?: string }>`
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
  ${({ backgroundImage }) => backgroundImage ? `
    background-image: url(${backgroundImage});
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  ` : `
    background: transparent;
  `}
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


const globalVideoBlacklist = loadBlacklist();

const VideoPlayer = memo<VideoPlayerProps>(({ currentTrack, showVideo = true }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setSearchPhase] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);
  const [noEmbeddableVideos, setNoEmbeddableVideos] = useState(false);
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);

  const fetchVideoForTrack = useCallback(async (track: Track) => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setNoEmbeddableVideos(false);
    setVideoLoadFailed(false);
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
        console.log(`No videos found for "${track.name}" by ${track.artists} - hiding video player`);
        setMediaItems([]);
        setError(null);
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

  // Always show the video container to maintain consistent card size
  const showPlaceholder = !showVideo || (mediaItems.length === 0 && !loading && !error) || videoLoadFailed || noEmbeddableVideos;
  const currentVideoItem = mediaItems.length > 0 ? mediaItems[0] : null;
  const showLoadingOverlay = loading;
  const showErrorOverlay = error && !loading;

  return (
    <Container>
      <AspectRatio ratio={16 / 9} className="w-full mb-4">
        <VideoContainer isPlaceholder={showPlaceholder}>
          {showPlaceholder ? (
            <PlaceholderContainer backgroundImage={currentTrack?.image} />
          ) : currentVideoItem ? (
            currentVideoItem.type === 'youtube' ? (
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
                onLoad={() => {
                  console.log(`Video loaded successfully for "${currentTrack?.name}"`);
                  setVideoLoadFailed(false);
                }}
                onError={() => {
                  console.log(`Video failed to load for "${currentTrack?.name}" - showing band photo`);
                  setVideoLoadFailed(true);
                }}
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
            )
          ) : (
            <PlaceholderContainer backgroundImage={currentTrack?.image} />
          )}
          
          {showLoadingOverlay && (
            <LoadingOverlay>
              <Spinner />
            </LoadingOverlay>
          )}
          
          {showErrorOverlay && (
            <LoadingOverlay>
              <SearchErrorDisplay 
                error={error}
                onRetry={() => fetchVideoForTrack(currentTrack)}
                onSkip={() => setError(null)}
              />
            </LoadingOverlay>
          )}
        </VideoContainer>
      </AspectRatio>
    </Container>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 