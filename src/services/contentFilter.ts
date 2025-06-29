import type { VideoSearchResult } from './youtubeSearch';

export interface ChannelFilters {
  whitelist: string[];  // Always prefer these channels
  blacklist: string[];  // Never show these channels
  patterns: {
    preferred: RegExp[];
    blocked: RegExp[];
  };
}

export interface FilteredVideoResult extends VideoSearchResult {
  qualityScore: number;
  relevanceScore: number;
  combinedScore: number;
  isFiltered: boolean;
  filterReason?: string;
}

export class ContentFilterService {
  private readonly AD_PROMO_INDICATORS = {
    titles: [
      /\b(ad|advertisement|sponsored|promo|commercial)\b/i,
      /\b(buy now|click here|limited time|discount)\b/i,
      /\b(sale|offer|deal|free trial)\b/i,
      /\b(subscribe|like|follow|notification)\b/i
    ],
    channels: [
      /ads?$/i,
      /marketing/i,
      /promo/i,
      /commercial/i,
      /sponsor/i
    ],
    descriptions: [
      /sponsored content/i,
      /paid promotion/i,
      /affiliate link/i,
      /promotional/i
    ]
  };

  private readonly CHANNEL_FILTERS: ChannelFilters = {
    whitelist: [
      'officialmusicvevo',
      'universalmusicgroup',
      'sonymusicvevo',
      'warnermusicgroup',
      'atlanticrecords',
      'emimusic',
      'republicrecords'
    ],
    blacklist: [
      'ads',
      'marketing',
      'sponsored',
      'commercial',
      'promotion',
      'advertisement'
    ],
    patterns: {
      preferred: [
        /vevo$/i,
        /official$/i,
        /records$/i,
        /music$/i,
        /\btopic\b/i
      ],
      blocked: [
        /fake/i,
        /spam/i,
        /bot$/i,
        /\bad\b/i,
        /promo$/i
      ]
    }
  };

  filterSearchResults(results: VideoSearchResult[], query: string): VideoSearchResult[] {
    const filtered = results
      .filter(video => this.passesBasicFilters(video))
      .map(video => this.addRelevanceScore(video, query))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`Filtered ${results.length} results to ${filtered.length} for query: ${query}`);
    return filtered;
  }

  isAdOrPromo(video: VideoSearchResult): boolean {
    // Check title for ad/promo indicators
    for (const pattern of this.AD_PROMO_INDICATORS.titles) {
      if (pattern.test(video.title)) {
        return true;
      }
    }

    // Check channel name for promotional patterns
    for (const pattern of this.AD_PROMO_INDICATORS.channels) {
      if (pattern.test(video.channelName)) {
        return true;
      }
    }

    // Check for blocked channels
    const channelLower = video.channelName.toLowerCase();
    if (this.CHANNEL_FILTERS.blacklist.some(blocked => channelLower.includes(blocked))) {
      return true;
    }

    // Check blocked patterns
    for (const pattern of this.CHANNEL_FILTERS.patterns.blocked) {
      if (pattern.test(video.channelName)) {
        return true;
      }
    }

    return false;
  }

  calculateRelevanceScore(video: VideoSearchResult, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const titleWords = video.title.toLowerCase().split(/\s+/);
    const channelWords = video.channelName.toLowerCase().split(/\s+/);
    
    let score = 0;
    
    // Exact phrase matches (highest score)
    if (titleWords.join(' ').includes(query.toLowerCase())) {
      score += 40;
    }
    
    // Individual word matches in title
    queryWords.forEach(word => {
      if (titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))) {
        score += 10;
      }
    });
    
    // Individual word matches in channel
    queryWords.forEach(word => {
      if (channelWords.some(channelWord => channelWord.includes(word) || word.includes(channelWord))) {
        score += 5;
      }
    });
    
    // Bonus for official indicators
    if (/\b(official|video)\b/i.test(video.title)) {
      score += 15;
    }
    
    // Major bonus for VEVO and official channels
    if (/vevo/i.test(video.channelName)) {
      score += 20;
    }
    
    if (/official/i.test(video.channelName)) {
      score += 15;
    }
    
    // Bonus for preferred channels
    const channelLower = video.channelName.toLowerCase();
    if (this.CHANNEL_FILTERS.whitelist.some(preferred => channelLower.includes(preferred))) {
      score += 25;
    }
    
    // Bonus for preferred patterns
    for (const pattern of this.CHANNEL_FILTERS.patterns.preferred) {
      if (pattern.test(video.channelName)) {
        score += 10;
        break; // Only apply one pattern bonus
      }
    }
    
    // Bonus for music-related indicators
    if (/\b(music|song|album)\b/i.test(video.title)) {
      score += 8;
    }
    
    // Penalty for covers, remixes, live versions (prefer originals)
    if (/\b(cover|remix|live|acoustic|karaoke)\b/i.test(video.title)) {
      score -= 5;
    }
    
    // Penalty for reaction videos, compilations
    if (/\b(reaction|reacts?|compilation|playlist)\b/i.test(video.title)) {
      score -= 10;
    }
    
    // Penalty for fan-made content
    if (/\b(fan\s*made|tribute|parody|version)\b/i.test(video.title)) {
      score -= 8;
    }
    
    return Math.max(0, Math.min(score, 100));
  }

  isAppropriateLength(duration: string): boolean {
    const seconds = this.parseDurationToSeconds(duration);
    
    // Filter out very short videos (likely ads) and very long videos (likely not music)
    return seconds >= 30 && seconds <= 900; // 30 seconds to 15 minutes
  }

  private passesBasicFilters(video: VideoSearchResult): boolean {
    // TODO: Implement basic filters

    // // Filter out ads and promotional content
    // if (this.isAdOrPromo(video)) {
    //   return false;
    // }
    
    // // Filter out inappropriate lengths
    // if (!this.isAppropriateLength(video.duration)) {
    //   return false;
    // }
    
    // // Filter out videos with suspicious titles
    // if (this.hasSuspiciousTitle(video.title)) {
    //   return false;
    // }
    
    // // Filter out channels with very few subscribers (proxy: view count)
    // if (this.hasLowQualityMetrics(video)) {
    //   return false;
    // }
    
    return true;
  }

  private hasSuspiciousTitle(title: string): boolean {
    // Filter out titles with excessive caps, symbols, or spam indicators
    const capsRatio = (title.match(/[A-Z]/g) || []).length / title.length;
    if (capsRatio > 0.7 && title.length > 10) {
      return true; // Too many capital letters
    }
    
    // Check for spam patterns
    const spamPatterns = [
      /click\s+here/i,
      /watch\s+now/i,
      /free\s+download/i,
      /\$\d+/i, // Money amounts
      /!!!/,    // Multiple exclamation marks
      /\?\?\?/, // Multiple question marks
      /subscribe.*like.*comment/i
    ];
    
    return spamPatterns.some(pattern => pattern.test(title));
  }

  private hasLowQualityMetrics(video: VideoSearchResult): boolean {
    // Very low view count might indicate low quality (with exceptions for new content)
    if (video.viewCount !== undefined && video.viewCount < 1000) {
      // Exception: don't filter out videos from high-quality channels
      if (!this.isHighQualityChannel(video.channelName)) {
        return true;
      }
    }
    
    return false;
  }

  private isHighQualityChannel(channelName: string): boolean {
    const channelLower = channelName.toLowerCase();
    
    // Check whitelist
    if (this.CHANNEL_FILTERS.whitelist.some(channel => channelLower.includes(channel))) {
      return true;
    }
    
    // Check preferred patterns
    return this.CHANNEL_FILTERS.patterns.preferred.some(pattern => pattern.test(channelName));
  }

  private addRelevanceScore(video: VideoSearchResult, query: string): VideoSearchResult & { relevanceScore: number } {
    const relevanceScore = this.calculateRelevanceScore(video, query);
    return {
      ...video,
      relevanceScore
    };
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

  // Advanced filtering methods
  filterByChannelQuality(results: VideoSearchResult[]): VideoSearchResult[] {
    return results.filter(video => {
      // Prioritize official channels
      if (this.isHighQualityChannel(video.channelName)) {
        return true;
      }
      
      // Filter out low-quality channels unless they have high view counts
      if (video.viewCount && video.viewCount > 100000) {
        return true; // High view count overrides channel quality concerns
      }
      
      return !this.isLowQualityChannel(video.channelName);
    });
  }

  private isLowQualityChannel(channelName: string): boolean {
    const lowQualityPatterns = [
      /\d{4,}/,        // Channels with lots of numbers (often spam)
      /random/i,
      /unofficial/i,
      /pirated?/i,
      /stolen/i,
      /repost/i
    ];
    
    return lowQualityPatterns.some(pattern => pattern.test(channelName));
  }

  // Scoring for integration with quality service
  createFilteredResult(
    video: VideoSearchResult, 
    query: string, 
    qualityScore: number = 0
  ): FilteredVideoResult {
    const relevanceScore = this.calculateRelevanceScore(video, query);
    const combinedScore = (qualityScore * 0.6) + (relevanceScore * 0.4);
    
    return {
      ...video,
      qualityScore,
      relevanceScore,
      combinedScore,
      isFiltered: false
    };
  }

  // Batch filtering with scoring
  filterAndScoreResults(
    results: VideoSearchResult[], 
    query: string,
    qualityScores?: Map<string, number>
  ): FilteredVideoResult[] {
    return results
      .filter(video => this.passesBasicFilters(video))
      .map(video => {
        const qualityScore = qualityScores?.get(video.id) || 0;
        return this.createFilteredResult(video, query, qualityScore);
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // Configuration methods
  addToWhitelist(channelName: string): void {
    if (!this.CHANNEL_FILTERS.whitelist.includes(channelName.toLowerCase())) {
      this.CHANNEL_FILTERS.whitelist.push(channelName.toLowerCase());
    }
  }

  addToBlacklist(channelName: string): void {
    if (!this.CHANNEL_FILTERS.blacklist.includes(channelName.toLowerCase())) {
      this.CHANNEL_FILTERS.blacklist.push(channelName.toLowerCase());
    }
  }

  getFilterStats(): { whitelistSize: number; blacklistSize: number } {
    return {
      whitelistSize: this.CHANNEL_FILTERS.whitelist.length,
      blacklistSize: this.CHANNEL_FILTERS.blacklist.length
    };
  }
}

// Export singleton instance
export const contentFilterService = new ContentFilterService();