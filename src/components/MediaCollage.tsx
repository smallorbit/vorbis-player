import { useState, useEffect, memo, useCallback } from 'react';
import type { Track } from '../services/dropbox';
import { youtubeService } from '../services/youtube';

type VideoMode = 'pandas' | 'puppies' | 'kitties';

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
  const [videoMode, setVideoMode] = useState<VideoMode>(() => {
    const saved = localStorage.getItem('panda-player-video-mode');
    return (saved as VideoMode) || 'pandas';
  });


  const fetchMediaContent = useCallback(async (track: Track) => {
    if (!track) return;

    setMediaItems([]);
    setLoading(true);
    try {
      const videoIds = await youtubeService.loadVideoIdsFromCategory(videoMode);
      if (videoIds.length === 0) {
        throw new Error(`No ${videoMode} video IDs found.`);
      }
      
      // Use shuffle counter to ensure different video selection when same song is clicked
      const videoIndex = (shuffleCounter + Math.floor(Math.random() * videoIds.length)) % videoIds.length;
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
        title: `Random ${videoMode.charAt(0).toUpperCase() + videoMode.slice(1, -1)} Video`,
        thumbnail: `https://i.ytimg.com/vi/${randomVideoId}/hqdefault.jpg`,
      };
      
      setMediaItems([video]);
    } catch (error) {
      console.error('Error fetching media content:', error);
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  }, [videoMode, shuffleCounter]);

  useEffect(() => {
    if (currentTrack) {
      fetchMediaContent(currentTrack);
    }
  }, [currentTrack, shuffleCounter, videoMode, fetchMediaContent]);

  const handleModeChange = (mode: VideoMode) => {
    setVideoMode(mode);
    localStorage.setItem('panda-player-video-mode', mode);
  };

  const getModeEmoji = (mode: VideoMode) => {
    switch (mode) {
      case 'pandas': return '🐼';
      case 'puppies': return '🐶';
      case 'kitties': return '🐱';
      default: return '🐼';
    }
  };

  const getModeTitle = (mode: VideoMode) => {
    switch (mode) {
      case 'pandas': return 'Panda Player';
      case 'puppies': return 'Puppy Player';
      case 'kitties': return 'Kitty Player';
      default: return 'Panda Player';
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/10">
        <div className="relative flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            {getModeTitle(videoMode)} {getModeEmoji(videoMode)}🎵
          </h3>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
              {(['pandas', 'puppies', 'kitties'] as VideoMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                    videoMode === mode
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {getModeEmoji(mode)}
                </button>
              ))}
            </div>
            
            {loading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            )}
          </div>
        </div>
        
        <div className="w-full">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="relative rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-105 hover:bg-white/20 w-full"
              style={{
                aspectRatio: '9/16', // Vertical aspect ratio for YouTube Shorts
                height: '400px'
              }}
            >
              {item.type === 'youtube' ? (
                <iframe
                  src={item.url}
                  title={item.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
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
          ))}
        </div>
        
        {mediaItems.length === 0 && !loading && (
          <div className="text-center text-white/60 py-8">
            <p>No media content available for this track</p>
          </div>
        )}
      </div>
    </div>
  );
});

MediaCollage.displayName = 'MediaCollage';

export default MediaCollage;