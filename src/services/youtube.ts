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


  async searchVideos(query: string, maxResults: number = 4, shuffleSeed: number = 0): Promise<YouTubeSearchResult> {
    // Extract single hashtag-appropriate word from query
    const hashtag = this.extractHashtag(query);
    
    // For now, return a single result pointing to the hashtag page
    // In the future, we could scrape this page to get actual video IDs
    const videos: YouTubeVideo[] = [{
      id: `hashtag-${hashtag}-${Date.now()}-${shuffleSeed}`,
      title: `#${hashtag} Video`,
      thumbnail: `https://via.placeholder.com/320x180/1a1a1a/ffffff?text=%23${hashtag}`,
      embedUrl: this.getRandomVideoByHashtag(hashtag, shuffleSeed)
    }];
    console.log("videos:", videos);

    return { videos };
  }

  private extractHashtag(query: string): string {
    // Clean the query and take the first meaningful word as hashtag
    const words = query
      .toLowerCase()
      .replace(/[^a-zA-Z\s]/g, '') // Remove non-letters
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Return the first word, or 'music' as fallback
    return words[0] || 'music';
  }

  private getRandomVideoByHashtag(hashtag: string, shuffleSeed: number = 0): string {
    // Map hashtags to curated videos that fit the theme - 100+ popular song title words
    const hashtagToVideos: Record<string, string[]> = {
      // Emotions & Feelings
      'love': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'heart': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'pain': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'happy': ['ZbZSe6N_BXs', 'y9K0SzFIf4A', 'L_jWHffIx5E'],
      'sad': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'cry': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'dream': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'hope': ['y9K0SzFIf4A', 'dQw4w9WgXcQ', '3AtDnEC4zak'],
      'fear': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'anger': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],

      // Time & Seasons
      'night': ['PWC6p9cT04I', 'jfKfPfyJRdk', 'TUVcZfQe-Kw'],
      'day': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'ZbZSe6N_BXs'],
      'morning': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'y9K0SzFIf4A'],
      'midnight': ['PWC6p9cT04I', 'jfKfPfyJRdk', 'TUVcZfQe-Kw'],
      'summer': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'ZbZSe6N_BXs'],
      'winter': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'jfKfPfyJRdk'],
      'spring': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'y9K0SzFIf4A'],
      'autumn': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'PWC6p9cT04I'],
      'yesterday': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'hTWKbfoikeg'],
      'tomorrow': ['y9K0SzFIf4A', 'dQw4w9WgXcQ', '3AtDnEC4zak'],

      // Nature & Elements
      'fire': ['3_8QaK4fkI0', 'hTWKbfoikeg', 'ZbZSe6N_BXs'],
      'water': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'jfKfPfyJRdk'],
      'earth': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],
      'air': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],
      'ocean': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'jfKfPfyJRdk'],
      'mountain': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],
      'forest': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'jfKfPfyJRdk'],
      'desert': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'rain': ['N6O2ncUKvlg', 'jfKfPfyJRdk', 'PWC6p9cT04I'],
      'snow': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'jfKfPfyJRdk'],

      // Space & Celestial
      'moon': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'jfKfPfyJRdk'],
      'sun': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'ZbZSe6N_BXs'],
      'star': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'eclipse': ['lXk_u6YkcAA','Mc1Sbgil224', 'GVoqAoWH0qk', 'mlAO826pGdQ','o5EJTvBzqtQ'],
      'galaxy': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'planet': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'space': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'universe': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],

      // Colors
      'blue': ['N6O2ncUKvlg', 'jfKfPfyJRdk', 'PWC6p9cT04I'],
      'red': ['3_8QaK4fkI0', 'hTWKbfoikeg', 'ZbZSe6N_BXs'],
      'black': ['PWC6p9cT04I', '3_8QaK4fkI0', 'hTWKbfoikeg'],
      'white': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'PWC6p9cT04I'],
      'green': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'jfKfPfyJRdk'],
      'gold': ['ZbZSe6N_BXs', 'y9K0SzFIf4A', 'TUVcZfQe-Kw'],
      'silver': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],
      'purple': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],

      // Actions & Movement
      'dance': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'TUVcZfQe-Kw'],
      'run': ['y9K0SzFIf4A', 'L_jWHffIx5E', '3_8QaK4fkI0'],
      'fly': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'y9K0SzFIf4A'],
      'jump': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'ZbZSe6N_BXs'],
      'walk': ['jfKfPfyJRdk', 'N6O2ncUKvlg', 'y9K0SzFIf4A'],
      'fall': ['3_8QaK4fkI0', 'hTWKbfoikeg', 'N6O2ncUKvlg'],
      'rise': ['y9K0SzFIf4A', 'PWC6p9cT04I', 'N6O2ncUKvlg'],
      'break': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],

      // Music & Sound
      'music': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'y9K0SzFIf4A'],
      'song': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'y9K0SzFIf4A'],
      'beat': ['TUVcZfQe-Kw', 'jfKfPfyJRdk', 'y9K0SzFIf4A'],
      'rhythm': ['TUVcZfQe-Kw', 'jfKfPfyJRdk', 'y9K0SzFIf4A'],
      'melody': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'y9K0SzFIf4A'],
      'bass': ['TUVcZfQe-Kw', 'jfKfPfyJRdk', '3_8QaK4fkI0'],
      'guitar': ['TUVcZfQe-Kw', 'jfKfPfyJRdk', 'y9K0SzFIf4A'],
      'piano': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'N6O2ncUKvlg'],

      // Abstract Concepts
      'soul': ['jfKfPfyJRdk', '3AtDnEC4zak', 'PWC6p9cT04I'],
      'spirit': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'energy': ['TUVcZfQe-Kw', 'y9K0SzFIf4A', 'ZbZSe6N_BXs'],
      'power': ['3_8QaK4fkI0', 'hTWKbfoikeg', 'y9K0SzFIf4A'],
      'magic': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],
      'mystery': ['PWC6p9cT04I', 'ZbZSe6N_BXs', 'hTWKbfoikeg'],
      'freedom': ['y9K0SzFIf4A', 'N6O2ncUKvlg', 'dQw4w9WgXcQ'],
      'peace': ['jfKfPfyJRdk', 'N6O2ncUKvlg', 'PWC6p9cT04I'],

      // Places & Locations
      'home': ['jfKfPfyJRdk', '3AtDnEC4zak', 'dQw4w9WgXcQ'],
      'city': ['TUVcZfQe-Kw', 'y9K0SzFIf4A', 'ZbZSe6N_BXs'],
      'road': ['y9K0SzFIf4A', 'jfKfPfyJRdk', 'dQw4w9WgXcQ'],
      'bridge': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],
      'tower': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],
      'castle': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],
      'island': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'jfKfPfyJRdk'],
      'valley': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],

      // Relationships
      'friend': ['y9K0SzFIf4A', 'L_jWHffIx5E', '3AtDnEC4zak'],
      'lover': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'baby': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'girl': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'boy': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'woman': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'man': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'kJQP7kiw5Fk'],
      'mother': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'hTWKbfoikeg'],
      'father': ['3AtDnEC4zak', 'dQw4w9WgXcQ', 'hTWKbfoikeg'],

      // States of Being
      'alive': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'TUVcZfQe-Kw'],
      'dead': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'lost': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'found': ['y9K0SzFIf4A', 'dQw4w9WgXcQ', '3AtDnEC4zak'],
      'broken': ['3_8QaK4fkI0', 'hTWKbfoikeg', '5qap5aO4i9A'],
      'whole': ['jfKfPfyJRdk', 'N6O2ncUKvlg', 'y9K0SzFIf4A'],
      'empty': ['3_8QaK4fkI0', 'hTWKbfoikeg', 'PWC6p9cT04I'],
      'full': ['y9K0SzFIf4A', 'TUVcZfQe-Kw', 'L_jWHffIx5E'],

      // Weather & Elements
      'storm': ['3_8QaK4fkI0', 'N6O2ncUKvlg', 'hTWKbfoikeg'],
      'wind': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'ZbZSe6N_BXs'],
      'thunder': ['3_8QaK4fkI0', 'N6O2ncUKvlg', 'hTWKbfoikeg'],
      'lightning': ['3_8QaK4fkI0', 'N6O2ncUKvlg', 'ZbZSe6N_BXs'],
      'cloud': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'jfKfPfyJRdk'],
      'sunshine': ['y9K0SzFIf4A', 'L_jWHffIx5E', 'ZbZSe6N_BXs'],

      // Vibes & Moods
      'chill': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'N6O2ncUKvlg'],
      'lofi': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'PWC6p9cT04I'],
      'vibe': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'y9K0SzFIf4A'],
      'mood': ['jfKfPfyJRdk', 'TUVcZfQe-Kw', 'ZbZSe6N_BXs'],
      'aesthetic': ['ZbZSe6N_BXs', 'PWC6p9cT04I', 'TUVcZfQe-Kw'],
      'retro': ['TUVcZfQe-Kw', 'ZbZSe6N_BXs', 'jfKfPfyJRdk'],
      'vintage': ['TUVcZfQe-Kw', 'ZbZSe6N_BXs', 'jfKfPfyJRdk'],
      'neon': ['ZbZSe6N_BXs', 'TUVcZfQe-Kw', 'PWC6p9cT04I'],

      // Generic fallbacks
      'art': ['ZbZSe6N_BXs', 'TUVcZfQe-Kw', 'PWC6p9cT04I'],
      'nature': ['N6O2ncUKvlg', 'ZbZSe6N_BXs', 'PWC6p9cT04I'],
      'life': ['y9K0SzFIf4A', 'L_jWHffIx5E', '3AtDnEC4zak'],
      'never': ['N6O2ncUKvlg', 'PWC6p9cT04I', 'y9K0SzFIf4A'],
      'snarl': ['PWC6p9cT04I', 'N6O2ncUKvlg', 'hTWKbfoikeg']
    };
    
    // Get videos for this hashtag, or fallback to general ones
    const videos = hashtagToVideos[hashtag];
    
    
    // Use shuffle seed to ensure different video selection
    const randomIndex = (shuffleSeed + Math.floor(Math.random() * videos.length)) % videos.length;
    const randomId = videos[randomIndex];
    return this.createEmbedUrl(randomId, {
      autoplay: true,
      mute: true,
      loop: true,
      controls: false
    });
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