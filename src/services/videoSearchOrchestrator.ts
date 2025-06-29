import { youtubeSearchService, type VideoSearchResult } from './youtubeSearch';
import { videoQualityService, type ResolutionLevel } from './videoQuality';
import { contentFilterService, type FilteredVideoResult } from './contentFilter';
import type { Track } from './spotify';

export interface VideoSearchOrchestrator {
  findBestVideo(track: Track): Promise<FilteredVideoResult | null>;
  findAlternativeVideos(track: Track, exclude?: string[]): Promise<FilteredVideoResult[]>;
  getVideoQuality(videoId: string): Promise<any>;
  clearCache(): void;
}

export interface VideoSearchOptions {
  maxResults?: number;
  excludeVideoIds?: string[];
  minQualityScore?: number;
  minRelevanceScore?: number;
  preferredChannels?: string[];
}

class VideoSearchOrchestratorImpl implements VideoSearchOrchestrator {
  private readonly DEFAULT_MAX_RESULTS = 10;
  private readonly MIN_QUALITY_THRESHOLD = 30;
  private readonly MIN_RELEVANCE_THRESHOLD = 40;

  async findBestVideo(track: Track): Promise<FilteredVideoResult | null> {
    if (!track || !track.name) {
      throw new Error('Valid track with name is required');
    }

    try {
      console.log(`Searching for best video: ${track.name} by ${track.artists}`);
      
      // Create search query
      const searchQuery = this.createSearchQuery(track);
      
      // Step 1: Search YouTube for videos
      const searchResults = await youtubeSearchService.searchVideos(searchQuery);
      
      if (searchResults.length === 0) {
        console.log(`No search results found for: ${searchQuery}`);
        return null;
      }

      // Step 2: Filter content (ads, duration, relevance)
      const filteredResults = contentFilterService.filterSearchResults(searchResults, searchQuery);
      
      if (filteredResults.length === 0) {
        console.log(`No results passed content filtering for: ${searchQuery}`);
        return null;
      }

      // Step 3: Score videos by quality and relevance
      const scoredResults = await this.scoreVideoResults(filteredResults, searchQuery);
      
      // Step 4: Select best result that meets minimum thresholds
      const bestResult = scoredResults.find(result => 
        result.qualityScore >= this.MIN_QUALITY_THRESHOLD &&
        result.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD
      );

      if (!bestResult) {
        // If no results meet threshold, return the highest scored result anyway
        console.log(`No results met quality thresholds, returning best available for: ${searchQuery}`);
        return scoredResults[0] || null;
      }

      console.log(`Found best video: ${bestResult.title} (Quality: ${bestResult.qualityScore}, Relevance: ${bestResult.relevanceScore})`);
      return bestResult;
      
    } catch (error) {
      console.error('Error finding best video:', error);
      return null;
    }
  }

  async findAlternativeVideos(track: Track, exclude: string[] = []): Promise<FilteredVideoResult[]> {
    if (!track || !track.name) {
      return [];
    }

    try {
      const searchQuery = this.createSearchQuery(track);
      const searchResults = await youtubeSearchService.searchVideos(searchQuery);
      
      // Filter out excluded video IDs
      const filteredByExclusion = searchResults.filter(result => 
        !exclude.includes(result.id)
      );
      
      // Apply content filtering
      const contentFiltered = contentFilterService.filterSearchResults(filteredByExclusion, searchQuery);
      
      // Score and return top alternatives
      const scoredResults = await this.scoreVideoResults(contentFiltered, searchQuery);
      
      return scoredResults.slice(0, this.DEFAULT_MAX_RESULTS);
      
    } catch (error) {
      console.error('Error finding alternative videos:', error);
      return [];
    }
  }

  async findTopVideos(track: Track, limit: number = 5): Promise<FilteredVideoResult[]> {
    const alternatives = await this.findAlternativeVideos(track);
    return alternatives.slice(0, limit);
  }

  async getVideoQuality(videoId: string): Promise<any> {
    return videoQualityService.getVideoQualityInfo(videoId);
  }

  clearCache(): void {
    videoQualityService.clearCache();
    // Note: YouTubeSearchService cache is handled internally
  }

  // Search with multiple fallback strategies
  async searchWithFallbacks(track: Track): Promise<FilteredVideoResult | null> {
    const fallbackStrategies = [
      // Strategy 1: Full search (song + artist + "official")
      () => this.searchWithQuery(track, `${track.name} ${track.artists} official music video`),
      
      // Strategy 2: Basic search (song + artist)
      () => this.searchWithQuery(track, `${track.name} ${track.artists}`),
      
      // Strategy 3: Song name only + "official"
      () => this.searchWithQuery(track, `${track.name} official`),
      
      // Strategy 4: Song name only
      () => this.searchWithQuery(track, track.name),
      
      // Strategy 5: Artist name + album (if available)
      () => track.album ? this.searchWithQuery(track, `${track.artists} ${track.album}`) : null
    ];

    for (let i = 0; i < fallbackStrategies.length; i++) {
      try {
        const strategy = fallbackStrategies[i];
        const result = await strategy();
        
        if (result) {
          console.log(`Search succeeded with fallback strategy ${i + 1}`);
          return result;
        }
      } catch (error) {
        console.warn(`Search strategy ${i + 1} failed:`, error);
        continue;
      }
    }

    console.error('All search strategies failed for track:', track.name);
    return null;
  }

  private async searchWithQuery(track: Track, query: string): Promise<FilteredVideoResult | null> {
    const searchResults = await youtubeSearchService.searchVideos(query);
    
    if (searchResults.length === 0) {
      return null;
    }
    
    const filteredResults = contentFilterService.filterSearchResults(searchResults, query);
    const scoredResults = await this.scoreVideoResults(filteredResults, query);
    
    return scoredResults[0] || null;
  }

  private createSearchQuery(track: Track): string {
    // Primary search: song + artist
    let query = `${track.name} ${track.artists}`;
    
    // Add "official" or "music video" to improve results
    if (!query.toLowerCase().includes('official')) {
      query += ' official music video';
    }
    
    return query;
  }

  private async scoreVideoResults(
    results: VideoSearchResult[], 
    searchQuery: string
  ): Promise<FilteredVideoResult[]> {
    // Score all videos in parallel for better performance
    const scoringPromises = results.map(async (result) => {
      try {
        const qualityScore = await videoQualityService.calculateQualityScore(result);
        const relevanceScore = contentFilterService.calculateRelevanceScore(result, searchQuery);
        
        const combinedScore = (qualityScore * 0.6) + (relevanceScore * 0.4);
        
        return {
          ...result,
          qualityScore,
          relevanceScore,
          combinedScore,
          isFiltered: false
        } as FilteredVideoResult;
      } catch (error) {
        console.error(`Error scoring video ${result.id}:`, error);
        
        // Return with minimal scoring if quality detection fails
        const relevanceScore = contentFilterService.calculateRelevanceScore(result, searchQuery);
        return {
          ...result,
          qualityScore: 0,
          relevanceScore,
          combinedScore: relevanceScore * 0.4, // Only relevance score
          isFiltered: false
        } as FilteredVideoResult;
      }
    });

    const scoredResults = await Promise.all(scoringPromises);
    
    // Sort by combined score (highest first)
    return scoredResults.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // Enhanced search with options
  async searchWithOptions(track: Track, options: VideoSearchOptions = {}): Promise<FilteredVideoResult[]> {
    const {
      maxResults = this.DEFAULT_MAX_RESULTS,
      excludeVideoIds = [],
      minQualityScore = this.MIN_QUALITY_THRESHOLD,
      minRelevanceScore = this.MIN_RELEVANCE_THRESHOLD,
      preferredChannels = []
    } = options;

    try {
      const searchQuery = this.createSearchQuery(track);
      const searchResults = await youtubeSearchService.searchVideos(searchQuery);
      
      // Apply exclusions
      let filteredResults = searchResults.filter(result => 
        !excludeVideoIds.includes(result.id)
      );
      
      // Apply content filtering
      filteredResults = contentFilterService.filterSearchResults(filteredResults, searchQuery);
      
      // Score videos
      const scoredResults = await this.scoreVideoResults(filteredResults, searchQuery);
      
      // Apply quality and relevance thresholds
      let finalResults = scoredResults.filter(result => 
        result.qualityScore >= minQualityScore &&
        result.relevanceScore >= minRelevanceScore
      );
      
      // If no results meet thresholds, return best available
      if (finalResults.length === 0) {
        finalResults = scoredResults;
      }
      
      // Apply preferred channels bonus
      if (preferredChannels.length > 0) {
        finalResults = this.applyChannelPreferences(finalResults, preferredChannels);
      }
      
      return finalResults.slice(0, maxResults);
      
    } catch (error) {
      console.error('Error in searchWithOptions:', error);
      return [];
    }
  }

  private applyChannelPreferences(results: FilteredVideoResult[], preferredChannels: string[]): FilteredVideoResult[] {
    return results.map(result => {
      const isPreferred = preferredChannels.some(channel => 
        result.channelName.toLowerCase().includes(channel.toLowerCase())
      );
      
      if (isPreferred) {
        // Boost score for preferred channels
        return {
          ...result,
          combinedScore: Math.min(result.combinedScore + 20, 100)
        };
      }
      
      return result;
    }).sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // Debugging and monitoring methods
  async getSearchStats(): Promise<{
    cacheSize: number;
    qualityCacheSize: number;
    filterStats: any;
  }> {
    return {
      cacheSize: 0, // YouTubeSearchService doesn't expose cache size
      qualityCacheSize: videoQualityService.getCacheSize(),
      filterStats: contentFilterService.getFilterStats()
    };
  }
}

// Export singleton instance
export const videoSearchOrchestrator = new VideoSearchOrchestratorImpl();