export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  embedUrl: string;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  error?: string;
}

class YouTubeService {
  private apiKey: string | null = null;

  constructor() {
    // In a real implementation, you'd get this from environment variables
    // For now, we'll use a placeholder or make it configurable
    this.apiKey = import.meta.env.VITE_YOUTUBE_API_KEY || null;
  }

  async searchVideos(query: string, maxResults: number = 4): Promise<YouTubeSearchResult> {
    if (!this.apiKey) {
      // Return mock data for development
      return this.getMockResults(query, maxResults);
    }

    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('maxResults', maxResults.toString());
      searchUrl.searchParams.set('key', this.apiKey);

      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      const videos: YouTubeVideo[] = data.items?.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        embedUrl: `https://www.youtube.com/embed/${item.id.videoId}?autoplay=1&mute=1&loop=1&playlist=${item.id.videoId}`
      })) || [];

      return { videos };
    } catch (error) {
      console.error('YouTube search error:', error);
      return {
        videos: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private getMockResults(query: string, maxResults: number): YouTubeSearchResult {
    // Mock data for development - replace with actual API calls
    const mockVideos: YouTubeVideo[] = Array.from({ length: Math.min(maxResults, 4) }, (_, i) => ({
      id: `youtube-mock-${query.replace(/\s+/g, '-')}-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: `${query} - Music Video ${i + 1}`,
      thumbnail: `https://via.placeholder.com/320x180/1a1a1a/ffffff?text=${encodeURIComponent(query)}`,
      embedUrl: this.getRandomMusicVideo()
    }));

    return { videos: mockVideos };
  }

  private getRandomMusicVideo(): string {
    // A few copyright-free or popular music videos for demonstration
    const videoIds = [
      'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
      'L_jWHffIx5E', // Smash Mouth - All Star
      'ZZ5LpwO-An4', // HEYYEYAAEYAAAEYAEYAA
      'y9K0SzFIf4A', // Queen - Don't Stop Me Now
      'fJ9rUzIMcZQ'  // Queen - Bohemian Rhapsody
    ];
    
    const randomId = videoIds[Math.floor(Math.random() * videoIds.length)];
    return `https://www.youtube.com/embed/${randomId}?autoplay=1&mute=1&loop=1&playlist=${randomId}`;
  }

  // Utility method to extract video ID from various YouTube URL formats
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

  // Create embed URL from video ID
  createEmbedUrl(videoId: string, options: {
    autoplay?: boolean;
    mute?: boolean;
    loop?: boolean;
    controls?: boolean;
  } = {}): string {
    const params = new URLSearchParams();
    
    if (options.autoplay) params.set('autoplay', '1');
    if (options.mute) params.set('mute', '1');
    if (options.loop) {
      params.set('loop', '1');
      params.set('playlist', videoId);
    }
    if (options.controls === false) params.set('controls', '0');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }
}

export const youtubeService = new YouTubeService();