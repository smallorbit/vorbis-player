import { useState, useEffect, memo, useCallback, useRef } from 'react';
import type { Track } from '../services/spotify';
import { youtubeService } from '../services/youtube';
import { HyperText } from './hyper-text';
import { useDebounce } from '../hooks/useDebounce';

type VideoMode = '80sTV' | '90sTV';

interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
}

interface MediaCollageProps {
  currentTrack: Track | null;
  shuffleCounter: number;
}

const MediaCollage = memo<MediaCollageProps>(({ currentTrack, shuffleCounter }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalShuffleCounter, setInternalShuffleCounter] = useState(0);
  const [videoMode, setVideoMode] = useState<VideoMode>(() => {
    const saved = localStorage.getItem('vorbis-player-video-mode');
    return (saved as VideoMode) || '80sTV';
  });
  const [lockVideoToTrack, setLockVideoToTrack] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-lock-video');
    return saved === 'true';
  });
  const lockedVideoRef = useRef<MediaItem | null>(null);

  const debouncedShuffleCounter = useDebounce(shuffleCounter, 300);
  const debouncedInternalShuffleCounter = useDebounce(internalShuffleCounter, 300);

  const getModeEmoji = useCallback((mode: VideoMode) => {
    switch (mode) {
      case '90sTV': return '⓽⓪s';
      case '80sTV': return '8️⃣0️⃣s';
      default: return '8️⃣0️⃣s'; // default to 80sTV
    }
  }, []);

  const getModeTitle = useCallback((mode: VideoMode) => {
    switch (mode) {
      case '80sTV': return "80's TV";
      case '90sTV': return "90's TV";
      default: return '80sTV';
    }
  }, []);

  const fetchMediaContent = useCallback(async (track: Track) => {
    if (!track) return;

    setMediaItems([]);
    setLoading(true);
    try {
      const videoIds = await youtubeService.loadVideoIdsFromCategory(videoMode);
      if (videoIds.length === 0) {
        throw new Error(`No ${videoMode} video IDs found.`);
      }

      const combinedShuffleCount = debouncedShuffleCounter + debouncedInternalShuffleCounter;
      const videoIndex = (combinedShuffleCount + Math.floor(Math.random() * videoIds.length)) % videoIds.length;
      const randomVideoId = videoIds[videoIndex];

      const video: MediaItem = {
        id: randomVideoId,
        type: 'youtube',
        url: youtubeService.createEmbedUrl(randomVideoId, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: true,
        }),
        title: `Random ${getModeTitle(videoMode)} Video`,
        thumbnail: `https://i.ytimg.com/vi/${randomVideoId}/hqdefault.jpg`,
      };

      setMediaItems([video]);
      lockedVideoRef.current = video;
    } catch (error) {
      console.error('Error fetching media content:', error);
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  }, [videoMode, debouncedShuffleCounter, debouncedInternalShuffleCounter, getModeTitle]);


  useEffect(() => {
    if (!currentTrack) return;
    
    if (lockVideoToTrack && lockedVideoRef.current) {
      setMediaItems([lockedVideoRef.current]);
      return;
    }
    
    fetchMediaContent(currentTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack, 
    debouncedShuffleCounter,
    debouncedInternalShuffleCounter, 
    videoMode, 
    fetchMediaContent
  ]);

  useEffect(() => {
    setInternalShuffleCounter(0);
  }, [currentTrack]);

  useEffect(() => {
    if (lockVideoToTrack && lockedVideoRef.current) {
      setMediaItems([lockedVideoRef.current]);
    }
  }, [lockVideoToTrack]);

  const handleModeChange = useCallback((mode: VideoMode) => {
    setVideoMode(mode);
    localStorage.setItem('vorbis-player-video-mode', mode);
  }, []);

  const handleLockVideoToggle = useCallback(() => {
    const newLockState = !lockVideoToTrack;
    setLockVideoToTrack(newLockState);
    localStorage.setItem('vorbis-player-lock-video', newLockState.toString());
  }, [lockVideoToTrack]);

  const handleShuffleVideo = useCallback(() => {
    setInternalShuffleCounter(prev => prev + 1);
  }, []);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/10">
        <div className="relative flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            {getModeTitle(videoMode)} 
          </h3>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
              {(['80sTV', '90sTV'] as VideoMode[]).map((mode) => (
                <ModeButton
                  key={mode}
                  mode={mode}
                  isActive={videoMode === mode}
                  onClick={handleModeChange}
                  emoji={getModeEmoji(mode)}
                />
              ))}
            </div>
            
            {/* Video Lock Toggle */}
            <button
              onClick={handleLockVideoToggle}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                lockVideoToTrack
                  ? 'bg-blue-600/80 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10 border border-white/20'
              }`}
              title={lockVideoToTrack ? 'Video locked to track (click to unlock)' : 'Video changes with tracks (click to lock)'}
            >
              {lockVideoToTrack ? '🔒' : '🔓'}
            </button>

            {loading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            )}
          </div>
        </div>

        <div className="w-full">
          {mediaItems.map((item) => (
            <VideoItem key={item.id} item={item} />
          ))}
        </div>

        {/* Shuffle Bar - Full width clickable area */}
        {mediaItems.length > 0 && (
          <button
            onClick={handleShuffleVideo}
            className="group w-full py-3 bg-white/5 hover:bg-white/10 border-t border-b border-white/10 transition-all duration-200 active:bg-white/15 flex justify-center items-center"
            title="Click anywhere to shuffle video"
          >
            <HyperText
              duration={600}
              className="text-white text-lg font-semibold tracking-wider pointer-events-none"
              as="span"
            >
              {"SHUFFLE " + getModeEmoji(videoMode)}
            </HyperText>
          </button>
        )}

        {mediaItems.length === 0 && !loading && (
          <div className="text-center text-white/60 py-8">
            <p>No media content available for this track</p>
          </div>
        )}

      </div>
    </div>
  );
});

const ModeButton = memo<{
  mode: VideoMode;
  isActive: boolean;
  onClick: (mode: VideoMode) => void;
  emoji: string;
}>(({ mode, isActive, onClick, emoji }) => {
  const handleClick = useCallback(() => onClick(mode), [mode, onClick]);
  
  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-white/20 text-white shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {emoji}
    </button>
  );
});

ModeButton.displayName = 'ModeButton';


const VideoItem = memo<{
  item: MediaItem;
}>(({ item }) => {
  return (
    <div
      className="relative rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:bg-white/20 w-full"
      style={{
        aspectRatio: '3/4',
        height: '390px'
      }}
    >
      {item.type === 'youtube' ? (
        <iframe
          src={item.url}
          title={item.title}
          className="w-full h-full border-0"
          style={{
            transform: 'scale(1.0)',
            transformOrigin: 'center center'
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <img
          src={item.url}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(item.title || 'No Image')}`;
          }}
        />
      )}

      {item.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white text-sm font-medium truncate">
            {item.title}
          </p>
        </div>
      )}
    </div>
  );
});

VideoItem.displayName = 'VideoItem';

MediaCollage.displayName = 'MediaCollage';

export default MediaCollage;
