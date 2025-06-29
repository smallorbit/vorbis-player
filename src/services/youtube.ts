export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  embedUrl: string;
  embeddable?: boolean;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  error?: string;
}

class YouTubeService {

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  createEmbedUrl(videoId: string, options: {
    autoplay?: boolean;
    mute?: boolean;
    loop?: boolean;
    controls?: boolean;
    enablejsapi?: boolean;
  } = {}): string {
    const params = new URLSearchParams();
    
    if (options.autoplay) params.set('autoplay', '1');
    if (options.mute) params.set('mute', '1');
    if (options.loop) {
      params.set('loop', '1');
      params.set('playlist', videoId);
    }
    if (options.controls === false) params.set('controls', '0');
    if (options.enablejsapi) params.set('enablejsapi', '1');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }

  private videoIdCache = new Map<string, string[]>();

  async loadVideoIdsFromCategory(category: string): Promise<string[]> {
    // Return cached result if available
    if (this.videoIdCache.has(category)) {
      return this.videoIdCache.get(category)!;
    }

    try {
      const videoIdsModule = await import(`../assets/${category}-videoIds.json`);
      const videoIds = videoIdsModule.default || [];
      
      // Cache the result for future use
      this.videoIdCache.set(category, videoIds);
      
      return videoIds;
    } catch (error) {
      console.error(`Failed to load video IDs for category: ${category}`, error);
      return [];
    }
  }
}

export const youtubeService = new YouTubeService();