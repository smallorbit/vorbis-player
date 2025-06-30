export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  embedUrl: string;
  embeddable?: boolean;
}

export interface VideoEmbeddingInfo {
  videoId: string;
  isEmbeddable: boolean;
  reason?: string | null;
  metadata: {
    title?: string;
    channelName?: string;
    isLiveStream?: boolean;
    responseLength?: number;
    hasPlayerConfig?: boolean;
  };
  timestamp: string;
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
  private embeddingCache = new Map<string, VideoEmbeddingInfo>();

  async checkVideoEmbeddability(videoId: string): Promise<VideoEmbeddingInfo> {
    // Return cached result if available and recent (1 hour cache)
    const cached = this.embeddingCache.get(videoId);
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      if (cacheAge < 60 * 60 * 1000) { // 1 hour
        return cached;
      }
    }

    try {
      // Use the embed-test endpoint for more accurate detection
      const proxyUrl = `http://127.0.0.1:3001/youtube/embed-test/${videoId}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        console.warn(`Failed to check embeddability for video ${videoId}:`, response.status);
        // Return default embeddable state if check fails
        const defaultInfo: VideoEmbeddingInfo = {
          videoId,
          isEmbeddable: true, // Assume embeddable if we can't check
          reason: null,
          metadata: {},
          timestamp: new Date().toISOString()
        };
        return defaultInfo;
      }

      const embeddingInfo: VideoEmbeddingInfo = await response.json();
      
      // Cache the result
      this.embeddingCache.set(videoId, embeddingInfo);
      
      console.log(`Video ${videoId} embeddability check:`, embeddingInfo.isEmbeddable ? 'EMBEDDABLE' : 'NOT EMBEDDABLE');
      
      return embeddingInfo;
    } catch (error) {
      console.error(`Error checking embeddability for video ${videoId}:`, error);
      
      // Return default embeddable state if check fails
      const defaultInfo: VideoEmbeddingInfo = {
        videoId,
        isEmbeddable: true, // Assume embeddable if we can't check
        reason: null,
        metadata: {},
        timestamp: new Date().toISOString()
      };
      return defaultInfo;
    }
  }

  async batchCheckEmbeddability(videoIds: string[]): Promise<Map<string, VideoEmbeddingInfo>> {
    const results = new Map<string, VideoEmbeddingInfo>();
    
    // Process in parallel with some concurrency limit to avoid overwhelming the proxy
    const concurrency = 3;
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += concurrency) {
      chunks.push(videoIds.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (videoId) => {
        const info = await this.checkVideoEmbeddability(videoId);
        results.set(videoId, info);
        return info;
      });
      
      await Promise.all(promises);
      
      // Add small delay between chunks to be respectful to the proxy/YouTube
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

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