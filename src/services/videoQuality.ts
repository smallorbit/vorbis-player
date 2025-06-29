import type { VideoSearchResult } from './youtubeSearch';

export enum ResolutionLevel {
  VERY_LOW = 'default',      // 120x90
  LOW = 'mqdefault',         // 320x180  
  MEDIUM = 'hqdefault',      // 480x360
  HIGH = 'maxresdefault'     // 1280x720+
}

export interface QualityScoreFactors {
  resolution: number;        // 0-50 points
  channelQuality: number;    // 0-20 points  
  titleIndicators: number;   // 0-20 points
  ageAndViews: number;       // 0-10 points
}

export interface VideoQualityInfo {
  videoId: string;
  resolutionLevel: ResolutionLevel;
  qualityScore: number;
  thumbnailUrls: {
    maxres: string;
    hq: string;
    mq: string;
    default: string;
  };
}

interface ResolutionCacheEntry {
  resolutionLevel: ResolutionLevel;
  timestamp: number;
  expiry: number;
}

export class VideoQualityService {
  private readonly RESOLUTION_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly THUMBNAIL_TEST_TIMEOUT = 5000; // 5 seconds
  
  private resolutionCache = new Map<string, ResolutionCacheEntry>();

  private readonly HIGH_QUALITY_CHANNEL_PATTERNS = [
    /vevo$/i,                    // Official music videos
    /official/i,                 // Official channels
    /records/i,                  // Record labels
    /(universal|sony|warner)/i,  // Major labels
    /\s+topic$/i                 // YouTube-generated topic channels
  ];

  private readonly QUALITY_TITLE_PATTERNS = [
    /\b(official|video|hd|4k|remastered)\b/i,
    /\b(1080p|720p|60fps)\b/i,
    /\b(lyrics|official\s+audio)\b/i
  ];

  async detectMaxResolution(videoId: string): Promise<ResolutionLevel> {
    if (!videoId || videoId.length !== 11) {
      return ResolutionLevel.VERY_LOW;
    }

    // Check cache first
    const cached = this.getFromResolutionCache(videoId);
    if (cached) {
      return cached;
    }

    const resolutionLevels = [
      ResolutionLevel.HIGH,      // Try highest first
      ResolutionLevel.MEDIUM,
      ResolutionLevel.LOW,
      ResolutionLevel.VERY_LOW   // Fallback
    ];

    for (const resolution of resolutionLevels) {
      const isAvailable = await this.testThumbnailAvailability(videoId, resolution);
      if (isAvailable) {
        this.cacheResolution(videoId, resolution);
        return resolution;
      }
    }

    // Fallback to very low if nothing works
    this.cacheResolution(videoId, ResolutionLevel.VERY_LOW);
    return ResolutionLevel.VERY_LOW;
  }

  async testThumbnailAvailability(videoId: string, resolution: string): Promise<boolean> {
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/${resolution}.jpg`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.THUMBNAIL_TEST_TIMEOUT);

      const response = await fetch(thumbnailUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);
      
      // YouTube returns 200 for valid thumbnails, 404 for missing ones
      return response.ok && response.status === 200;
    } catch (error) {
      // Network error, timeout, or abort
      return false;
    }
  }

  async calculateQualityScore(video: VideoSearchResult): Promise<number> {
    let score = 0;
    
    // Resolution scoring (most important - 0-50 points)
    const resolution = await this.detectMaxResolution(video.id);
    score += this.getResolutionScore(resolution);
    
    // Channel quality indicators (0-20 points)
    score += this.getChannelQualityScore(video.channelName);
    
    // Title quality indicators (0-20 points)
    score += this.getTitleQualityScore(video.title);
    
    // View count and popularity factors (0-10 points)
    score += this.getPopularityScore(video);
    
    return Math.min(score, 100);
  }

  private getResolutionScore(resolution: ResolutionLevel): number {
    switch (resolution) {
      case ResolutionLevel.HIGH:
        return 50; // Highest score for HD+
      case ResolutionLevel.MEDIUM:
        return 35; // Good score for SD
      case ResolutionLevel.LOW:
        return 20; // Lower score for low res
      case ResolutionLevel.VERY_LOW:
        return 5;  // Minimal score for very low res
      default:
        return 0;
    }
  }

  private getChannelQualityScore(channelName: string): number {
    if (!channelName) return 0;
    
    let score = 0;
    const lowerChannelName = channelName.toLowerCase();
    
    // Check for high-quality channel patterns
    for (const pattern of this.HIGH_QUALITY_CHANNEL_PATTERNS) {
      if (pattern.test(channelName)) {
        if (lowerChannelName.includes('vevo')) {
          score += 20; // Maximum bonus for VEVO
        } else if (lowerChannelName.includes('official')) {
          score += 15; // High bonus for official channels
        } else if (lowerChannelName.includes('records')) {
          score += 12; // Good bonus for record labels
        } else if (/(universal|sony|warner)/i.test(channelName)) {
          score += 18; // High bonus for major labels
        } else if (/\s+topic$/i.test(channelName)) {
          score += 10; // Moderate bonus for topic channels
        } else {
          score += 8; // Generic bonus for other patterns
        }
        break; // Only apply one bonus
      }
    }
    
    // Additional checks for specific indicators
    if (lowerChannelName.includes('music')) {
      score += 3;
    }
    
    if (lowerChannelName.includes('official') && !lowerChannelName.includes('vevo')) {
      score += 5;
    }
    
    return Math.min(score, 20); // Cap at 20 points
  }

  private getTitleQualityScore(title: string): number {
    if (!title) return 0;
    
    let score = 0;
    
    // Check for quality indicators in title
    for (const pattern of this.QUALITY_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        if (/\b(4k|hd|1080p)\b/i.test(title)) {
          score += 15; // High bonus for explicit quality indicators
        } else if (/\b(official|video)\b/i.test(title)) {
          score += 10; // Good bonus for official indicators
        } else if (/\b(remastered|720p)\b/i.test(title)) {
          score += 8; // Moderate bonus for remastered/720p
        } else if (/\b(lyrics|audio)\b/i.test(title)) {
          score += 5; // Lower bonus for audio-only content
        } else {
          score += 3; // Generic bonus for other quality patterns
        }
      }
    }
    
    // Bonus for music video indicators
    if (/music\s+video/i.test(title)) {
      score += 5;
    }
    
    // Penalty for low-quality indicators
    if (/\b(cover|remix|live|concert|acoustic)\b/i.test(title)) {
      score -= 3; // Prefer original versions
    }
    
    if (/\b(fan\s*made|tribute|parody)\b/i.test(title)) {
      score -= 5; // Penalty for fan content
    }
    
    return Math.max(0, Math.min(score, 20)); // Cap between 0-20 points
  }

  private getPopularityScore(video: VideoSearchResult): number {
    let score = 0;
    
    // View count scoring
    if (video.viewCount) {
      if (video.viewCount >= 100000000) { // 100M+ views
        score += 10;
      } else if (video.viewCount >= 10000000) { // 10M+ views
        score += 8;
      } else if (video.viewCount >= 1000000) { // 1M+ views
        score += 6;
      } else if (video.viewCount >= 100000) { // 100K+ views
        score += 4;
      } else if (video.viewCount >= 10000) { // 10K+ views
        score += 2;
      }
    }
    
    // Duration scoring (prefer typical music video lengths)
    const durationScore = this.getDurationScore(video.duration);
    score += durationScore;
    
    return Math.min(score, 10); // Cap at 10 points
  }

  private getDurationScore(duration: string): number {
    const seconds = this.parseDurationToSeconds(duration);
    
    if (seconds >= 120 && seconds <= 360) { // 2-6 minutes (typical music videos)
      return 3;
    } else if (seconds >= 60 && seconds <= 480) { // 1-8 minutes (acceptable range)
      return 2;
    } else if (seconds >= 30 && seconds <= 600) { // 30 seconds - 10 minutes
      return 1;
    } else {
      return 0; // Too short or too long
    }
  }

  private parseDurationToSeconds(duration: string): number {
    if (!duration) return 0;
    
    // Handle formats like "3:45" or "1:23:45"
    const parts = duration.split(':').map(part => parseInt(part, 10));
    
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      return 0;
    }
  }

  async getVideoQualityInfo(videoId: string): Promise<VideoQualityInfo> {
    const resolutionLevel = await this.detectMaxResolution(videoId);
    
    // Create mock video for quality scoring
    const mockVideo: VideoSearchResult = {
      id: videoId,
      title: '',
      channelName: '',
      duration: '',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
    
    const qualityScore = await this.calculateQualityScore(mockVideo);
    
    return {
      videoId,
      resolutionLevel,
      qualityScore,
      thumbnailUrls: {
        maxres: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        hq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        mq: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        default: `https://i.ytimg.com/vi/${videoId}/default.jpg`
      }
    };
  }

  // Resolution caching methods
  private getFromResolutionCache(videoId: string): ResolutionLevel | null {
    const entry = this.resolutionCache.get(videoId);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now > entry.expiry) {
      this.resolutionCache.delete(videoId);
      return null;
    }
    
    return entry.resolutionLevel;
  }

  private cacheResolution(videoId: string, resolutionLevel: ResolutionLevel): void {
    const now = Date.now();
    const entry: ResolutionCacheEntry = {
      resolutionLevel,
      timestamp: now,
      expiry: now + this.RESOLUTION_CACHE_DURATION
    };
    
    this.resolutionCache.set(videoId, entry);
    
    // Clean expired entries periodically
    if (this.resolutionCache.size > 1000) {
      this.cleanExpiredResolutionCache();
    }
  }

  private cleanExpiredResolutionCache(): void {
    const now = Date.now();
    
    for (const [videoId, entry] of this.resolutionCache.entries()) {
      if (now > entry.expiry) {
        this.resolutionCache.delete(videoId);
      }
    }
  }

  // Public method to clear cache
  clearCache(): void {
    this.resolutionCache.clear();
  }

  // Debugging/testing methods
  getCacheSize(): number {
    return this.resolutionCache.size;
  }

  getCacheHitRate(): number {
    // This would require tracking hits/misses in a real implementation
    return 0; // Placeholder
  }
}

// Export singleton instance
export const videoQualityService = new VideoQualityService();