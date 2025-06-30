import { youtubeSearchService, type VideoSearchResult } from './youtubeSearch';
import { videoQualityService, type ResolutionLevel } from './videoQuality';
import { contentFilterService, type FilteredVideoResult } from './contentFilter';
import { youtubeService } from './youtube';
import type { Track } from './spotify';

export interface VideoSearchResult {
  videos: FilteredVideoResult[];
  allFilteredDueToEmbedding?: boolean;
}

export interface VideoSearchOrchestrator {
  findBestVideo(track: Track): Promise<FilteredVideoResult | null>;
  findAlternativeVideos(track: Track, exclude?: string[]): Promise<FilteredVideoResult[]>;
  findAlternativeVideosWithMetadata(track: Track, exclude?: string[]): Promise<VideoSearchResult>;
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

      // Step 2.5: Pre-check embedding capabilities for top candidates
      const embeddableResults = await this.filterEmbeddableVideos(filteredResults.slice(0, 5));
      
      if (embeddableResults.length === 0) {
        console.log(`No embeddable videos found for: ${searchQuery}`);
        // Fallback to original results if embedding check fails for all
        console.log('Falling back to original results without embedding pre-check');
      }

      // Step 3: Score videos by quality and relevance
      const resultsToScore = embeddableResults.length > 0 ? embeddableResults : filteredResults;
      const scoredResults = await this.scoreVideoResults(resultsToScore, searchQuery);
      
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
    const result = await this.findAlternativeVideosWithMetadata(track, exclude);
    return result.videos;
  }

  async findAlternativeVideosWithMetadata(track: Track, exclude: string[] = []): Promise<VideoSearchResult> {
    if (!track || !track.name) {
      return { videos: [] };
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
      
      // Pre-check embedability for top alternatives
      const embeddableResults = await this.filterEmbeddableVideos(contentFiltered.slice(0, 10));
      
      // Check if all videos were filtered due to embedding restrictions
      const allFilteredDueToEmbedding = contentFiltered.length > 0 && embeddableResults.length === 0;
      
      // Score and return top alternatives
      const resultsToScore = embeddableResults.length > 0 ? embeddableResults : contentFiltered;
      const scoredResults = await this.scoreVideoResults(resultsToScore, searchQuery);
      
      return {
        videos: scoredResults.slice(0, this.DEFAULT_MAX_RESULTS),
        allFilteredDueToEmbedding
      };
      
    } catch (error) {
      console.error('Error finding alternative videos:', error);
      return { videos: [] };
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

  private async filterEmbeddableVideos(results: VideoSearchResult[]): Promise<VideoSearchResult[]> {
    if (results.length === 0) {
      return results;
    }

    try {
      console.log(`Pre-checking embedding capabilities for ${results.length} videos`);
      
      // Extract video IDs
      const videoIds = results.map(result => result.id);
      
      // Batch check embedding capabilities
      const embeddingInfo = await youtubeService.batchCheckEmbeddability(videoIds);
      
      // Filter to only embeddable videos
      const embeddableResults = results.filter(result => {
        const info = embeddingInfo.get(result.id);
        return info?.isEmbeddable ?? true; // Default to embeddable if check failed
      });
      
      console.log(`Filtered to ${embeddableResults.length} embeddable videos from ${results.length} candidates`);
      
      // Store info about embedding filtering for debugging
      if (embeddableResults.length === 0 && results.length > 0) {
        console.warn(`⚠️ All ${results.length} video candidates were filtered out due to embedding restrictions`);
      }
      
      return embeddableResults;
      
    } catch (error) {
      console.error('Error pre-checking video embeddability:', error);
      // Return original results if embedding check fails
      return results;
    }
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