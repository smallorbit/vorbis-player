import { useState, useEffect, memo } from 'react';
import type { Track } from '../services/dropbox';
import { youtubeService } from '../services/youtube';

interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
}

interface MediaCollageProps {
  currentTrack: Track | null;
}

const MediaCollage = memo<MediaCollageProps>(({ currentTrack }) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const extractKeywords = (title: string): string[] => {
    // Remove track numbers, file extensions, and common separators
    const cleaned = title
      .replace(/^\d+[\s\-\.]*/, '') // Remove leading numbers
      .replace(/\.(mp3|wav|flac|m4a|ogg)$/i, '') // Remove file extensions
      .replace(/[\-_]+/g, ' ') // Replace dashes/underscores with spaces
      .trim();
    
    // Split into words and filter out common stopwords
    const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return cleaned
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word.toLowerCase()))
      .slice(0, 3); // Limit to first 3 meaningful words
  };

  const fetchMediaContent = async (track: Track) => {
    if (!track) return;
    
    // Clear previous media items immediately
    setMediaItems([]);
    setLoading(true);
    try {
      const keywords = extractKeywords(track.title);
      const searchQuery = keywords.join(' ');
      
      const youtubeResult = await youtubeService.searchVideos(searchQuery, 1);
      
      const mediaItems: MediaItem[] = [];
      
      // Add YouTube video if available
      if (youtubeResult.videos.length > 0) {
        const video = youtubeResult.videos[0];
        mediaItems.push({
          id: video.id,
          type: 'youtube',
          url: video.embedUrl,
          title: video.title,
          thumbnail: video.thumbnail
        });
      }
      
      setMediaItems(mediaItems);
    } catch (error) {
      console.error('Error fetching media content:', error);
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTrack) {
      fetchMediaContent(currentTrack);
    }
  }, [currentTrack]);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
             Vorbis Audio Player
          </h3>
          {loading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          )}
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
                  className="w-full h-full"
                  frameBorder="0"
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