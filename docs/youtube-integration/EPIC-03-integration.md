# EPIC 03: System Integration

## Overview
This epic focuses on integrating all the new YouTube search services with the existing application architecture. This phase requires completion of both Epic 1 (Core Services) and Epic 2 (UI Components) before beginning.

## Concurrent Agent Assignment

### **Agent 3A: Service Integration & Enhancement**
**Primary responsibility: YouTube service integration and performance optimization**

### **Agent 3B: AudioPlayer Integration & System Testing**
**Primary responsibility: Main application integration and end-to-end functionality**

---

## Agent 3A Tasks: Service Integration & Enhancement

### Task 3A1: Integrate Search Services into Existing YouTube Service
**File**: `src/services/youtube.ts` (modify existing)

**Current State Analysis**:
```typescript
// Current youtube.ts structure:
class YouTubeService {
  extractVideoId(url: string): string | null
  createEmbedUrl(videoId: string, options): string
  loadVideoIdsFromCategory(category: string): Promise<string[]>
}
```

**Integration Requirements**:
```typescript
// Enhanced YouTubeService with search capabilities
class YouTubeService {
  // Existing methods - PRESERVE
  extractVideoId(url: string): string | null;
  createEmbedUrl(videoId: string, options): string;
  
  // DEPRECATED - will be removed after integration
  loadVideoIdsFromCategory(category: string): Promise<string[]>;
  
  // NEW - Search-based methods
  searchForTrack(track: Track): Promise<FilteredVideoResult | null>;
  searchForTrackAlternatives(track: Track, exclude?: string[]): Promise<FilteredVideoResult[]>;
  getVideoQualityInfo(videoId: string): Promise<VideoQualityInfo>;
  
  // NEW - Integration with core services
  private youtubeSearch: YouTubeSearchService;
  private videoQuality: VideoQualityService;
  private contentFilter: ContentFilterService;
  private searchCache: Map<string, CachedSearchResult>;
}
```

**Implementation Strategy**:
```typescript
class YouTubeService {
  constructor() {
    // Initialize core services
    this.youtubeSearch = new YouTubeSearchService();
    this.videoQuality = new VideoQualityService();
    this.contentFilter = new ContentFilterService();
    this.searchCache = new Map();
  }
  
  async searchForTrack(track: Track): Promise<FilteredVideoResult | null> {
    const searchQuery = this.createSearchQuery(track);
    const cacheKey = this.getCacheKey(searchQuery);
    
    // Check cache first
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.result;
      }
    }
    
    try {
      // Step 1: Search YouTube
      const searchResults = await this.youtubeSearch.searchVideos(searchQuery);
      
      // Step 2: Filter content (ads, duration, relevance)
      const filteredResults = this.contentFilter.filterSearchResults(searchResults, searchQuery);
      
      // Step 3: Test video quality and score
      const qualityResults = await Promise.all(
        filteredResults.map(async (result) => {
          const qualityScore = await this.videoQuality.calculateQualityScore(result);
          const relevanceScore = this.contentFilter.calculateRelevanceScore(result, searchQuery);
          
          return {
            ...result,
            qualityScore,
            relevanceScore,
            combinedScore: (qualityScore * 0.6) + (relevanceScore * 0.4) // Weight quality higher
          } as FilteredVideoResult;
        })
      );
      
      // Step 4: Select best result
      const bestResult = qualityResults
        .filter(result => result.combinedScore >= 40) // Minimum threshold
        .sort((a, b) => b.combinedScore - a.combinedScore)[0] || null;
      
      // Cache result
      this.searchCache.set(cacheKey, {
        result: bestResult,
        timestamp: Date.now()
      });
      
      return bestResult;
    } catch (error) {
      console.error('Search failed:', error);
      return null;
    }
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
  
  private getCacheKey(searchQuery: string): string {
    return `search:${searchQuery.toLowerCase().replace(/\s+/g, '_')}`;
  }
}
```

### Task 3A2: Add Search-Based Video Fetching Methods
**New Service Methods**:
```typescript
interface VideoSearchOptions {
  maxResults?: number;
  excludeVideoIds?: string[];
  minQualityScore?: number;
  minRelevanceScore?: number;
  preferredChannels?: string[];
}

class YouTubeService {
  async searchForTrackAlternatives(
    track: Track, 
    options: VideoSearchOptions = {}
  ): Promise<FilteredVideoResult[]> {
    const searchQuery = this.createSearchQuery(track);
    const searchResults = await this.youtubeSearch.searchVideos(searchQuery);
    
    let filteredResults = this.contentFilter.filterSearchResults(searchResults, searchQuery);
    
    // Apply exclusions
    if (options.excludeVideoIds) {
      filteredResults = filteredResults.filter(result => 
        !options.excludeVideoIds!.includes(result.id)
      );
    }
    
    // Score and filter by quality/relevance
    const scoredResults = await this.scoreVideoResults(filteredResults, searchQuery);
    
    return scoredResults
      .filter(result => {
        return (
          result.qualityScore >= (options.minQualityScore || 30) &&
          result.relevanceScore >= (options.minRelevanceScore || 40)
        );
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, options.maxResults || 10);
  }
  
  async getVideoQualityInfo(videoId: string): Promise<VideoQualityInfo> {
    const resolutionLevel = await this.videoQuality.detectMaxResolution(videoId);
    const qualityScore = await this.videoQuality.calculateQualityScore({
      id: videoId,
      // Mock minimal video data for quality testing
      title: '',
      channelName: '',
      duration: ''
    });
    
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
  
  private async scoreVideoResults(
    results: VideoSearchResult[], 
    searchQuery: string
  ): Promise<FilteredVideoResult[]> {
    return Promise.all(
      results.map(async (result) => {
        const qualityScore = await this.videoQuality.calculateQualityScore(result);
        const relevanceScore = this.contentFilter.calculateRelevanceScore(result, searchQuery);
        
        return {
          ...result,
          qualityScore,
          relevanceScore,
          combinedScore: (qualityScore * 0.6) + (relevanceScore * 0.4),
          resolutionLevel: await this.videoQuality.detectMaxResolution(result.id),
          isFiltered: false
        };
      })
    );
  }
}
```

### Task 3A3: Update Embed URL Creation with Quality Preferences
**Enhanced Embed URL Generation**:
```typescript
interface EmbedOptions {
  autoplay?: boolean;
  mute?: boolean;
  loop?: boolean;
  controls?: boolean;
  quality?: 'hd720' | 'hd1080' | 'auto'; // NEW
  startTime?: number; // NEW - start at specific time
  preferredResolution?: ResolutionLevel; // NEW
}

class YouTubeService {
  createEmbedUrl(videoId: string, options: EmbedOptions = {}): string {
    const params = new URLSearchParams();
    
    // Existing parameters
    if (options.autoplay) params.set('autoplay', '1');
    if (options.mute) params.set('mute', '1');
    if (options.loop) {
      params.set('loop', '1');
      params.set('playlist', videoId);
    }
    if (options.controls === false) params.set('controls', '0');
    
    // NEW - Quality preferences
    if (options.quality) {
      params.set('vq', options.quality); // Request specific quality
    }
    
    if (options.startTime) {
      params.set('start', options.startTime.toString());
    }
    
    // NEW - Additional parameters for better experience
    params.set('rel', '0'); // Don't show related videos
    params.set('modestbranding', '1'); // Reduce YouTube branding
    params.set('iv_load_policy', '3'); // Don't show video annotations
    
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }
  
  // NEW - Create optimized embed URL based on detected quality
  createOptimizedEmbedUrl(videoResult: FilteredVideoResult, options: EmbedOptions = {}): string {
    const qualityOptions = { ...options };
    
    // Set quality preference based on detected resolution
    switch (videoResult.resolutionLevel) {
      case ResolutionLevel.HIGH:
        qualityOptions.quality = 'hd1080';
        break;
      case ResolutionLevel.MEDIUM:  
        qualityOptions.quality = 'hd720';
        break;
      default:
        qualityOptions.quality = 'auto';
    }
    
    return this.createEmbedUrl(videoResult.id, qualityOptions);
  }
}
```

### Task 3A4: Error Handling and Fallback Strategies
**Comprehensive Error Handling**:
```typescript
interface SearchErrorContext {
  track: Track;
  searchQuery: string;
  attempt: number;
  lastError: Error;
}

class YouTubeService {
  async searchForTrackWithFallbacks(track: Track): Promise<FilteredVideoResult | null> {
    const fallbackStrategies = [
      // Strategy 1: Full search (song + artist + "official")
      () => this.searchWithQuery(`${track.name} ${track.artists} official music video`),
      
      // Strategy 2: Basic search (song + artist)
      () => this.searchWithQuery(`${track.name} ${track.artists}`),
      
      // Strategy 3: Song name only + "official"
      () => this.searchWithQuery(`${track.name} official`),
      
      // Strategy 4: Song name only
      () => this.searchWithQuery(track.name),
      
      // Strategy 5: Artist name + genre (if available)
      () => track.album ? this.searchWithQuery(`${track.artists} ${track.album}`) : null
    ];
    
    for (let i = 0; i < fallbackStrategies.length; i++) {
      try {
        const strategy = fallbackStrategies[i];
        const result = await strategy();
        
        if (result) {
          console.log(`Search succeeded with strategy ${i + 1}`);
          return result;
        }
      } catch (error) {
        console.warn(`Search strategy ${i + 1} failed:`, error);
        
        // Handle rate limiting
        if (this.isRateLimitError(error)) {
          console.log('Rate limited, waiting before retry...');
          await this.waitForRateLimit();
        }
        
        continue;
      }
    }
    
    console.error('All search strategies failed for track:', track.name);
    return null;
  }
  
  private async searchWithQuery(query: string): Promise<FilteredVideoResult | null> {
    const searchResults = await this.youtubeSearch.searchVideos(query);
    
    if (searchResults.length === 0) {
      return null;
    }
    
    const filteredResults = this.contentFilter.filterSearchResults(searchResults, query);
    const bestResult = await this.findBestQualityResult(filteredResults, query);
    
    return bestResult;
  }
  
  private isRateLimitError(error: any): boolean {
    return error.message?.includes('rate limit') || 
           error.message?.includes('too many requests') ||
           error.status === 429;
  }
  
  private async waitForRateLimit(): Promise<void> {
    // Exponential backoff: 2, 4, 8 seconds
    const delay = Math.min(2000 * Math.pow(2, this.rateLimitAttempts), 8000);
    this.rateLimitAttempts++;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  private rateLimitAttempts = 0;
}
```

---

## Agent 3B Tasks: AudioPlayer Integration & System Testing

### Task 3B1: Re-enable MediaCollage in AudioPlayer
**File**: `src/components/AudioPlayer.tsx` (modify existing)

**Current State**:
```typescript
// Currently commented out:
// import MediaCollage from './MediaCollage';
// <MediaCollage currentTrack={currentTrack} shuffleCounter={shuffleCounter} />
```

**Integration Steps**:
```typescript
// 1. Uncomment and update imports
import MediaCollage from './MediaCollage';

// 2. Remove shuffleCounter state (no longer needed)
// const [shuffleCounter, setShuffleCounter] = useState(0); // REMOVE

// 3. Update MediaCollage integration
const renderContent = () => {
  // ... existing loading and error states
  
  return (
    <ContentWrapper>
      {/* NEW - Re-enable MediaCollage with updated props */}
      <MediaCollage currentTrack={currentTrack} />
      
      <PlaylistSection>
        <Suspense fallback={PlaylistFallback}>
          <Playlist
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            onTrackSelect={playTrack}
          />
        </Suspense>
      </PlaylistSection>
      
      <LoadingCard backgroundImage={currentTrack?.image}>
        <CardContent style={{ padding: '1rem' }}>
          <SpotifyPlayerControls
            currentTrack={currentTrack}
            onPlay={() => spotifyPlayer.resume()}
            onPause={() => spotifyPlayer.pause()}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        </CardContent>
      </LoadingCard>
    </ContentWrapper>
  );
};
```

### Task 3B2: Remove Video Mode Related State/Logic
**Cleanup Tasks**:
```typescript
// REMOVE all video mode related code:

// 1. Remove any videoMode state or localStorage references
// (Should already be clean, but verify)

// 2. Remove any mode-related event handlers
// (Should already be clean, but verify)

// 3. Update component prop passing
// Before: <MediaCollage currentTrack={currentTrack} shuffleCounter={shuffleCounter} />
// After:  <MediaCollage currentTrack={currentTrack} />

// 4. Clean up any lingering shuffleCounter references
const handleNext = useCallback(() => {
  if (tracks.length === 0) return;
  const nextIndex = (currentTrackIndex + 1) % tracks.length;
  playTrack(nextIndex);
  // REMOVED: setShuffleCounter(0);
}, [currentTrackIndex, tracks.length, playTrack]);

const handlePrevious = useCallback(() => {
  if (tracks.length === 0) return;
  const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
  playTrack(prevIndex);
  // REMOVED: setShuffleCounter(0);
}, [currentTrackIndex, tracks.length, playTrack]);
```

### Task 3B3: Update Track Passing to MediaCollage
**Ensure Proper Track Data Flow**:
```typescript
// Verify track data integrity
const currentTrack = useMemo(() => {
  const track = tracks[currentTrackIndex] || null;
  
  // Log for debugging during integration
  if (track) {
    console.log('Current track for video search:', {
      name: track.name,
      artists: track.artists,
      album: track.album,
      duration: track.duration_ms
    });
  }
  
  return track;
}, [tracks, currentTrackIndex]);

// Enhanced track selection with video integration awareness
const playTrack = useCallback(async (index: number) => {
  if (tracks[index]) {
    try {
      await spotifyPlayer.playTrack(tracks[index].uri);
      setCurrentTrackIndex(index);
      
      // Log track change for video integration debugging
      console.log('Track changed, MediaCollage will search for:', tracks[index].name);
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }
}, [tracks]);
```

### Task 3B4: Integration Testing and Debugging
**Integration Testing Checklist**:
```typescript
// Create integration testing utilities
interface IntegrationTestResults {
  trackLoading: boolean;
  videoSearching: boolean;
  videoDisplaying: boolean;
  errorHandling: boolean;
  performanceMetrics: {
    searchTime: number;
    qualityTestTime: number;
    totalLoadTime: number;
  };
}

// Add debugging helpers (remove in production)
const debugIntegration = useCallback(() => {
  console.group('YouTube Integration Debug');
  console.log('Current track:', currentTrack);
  console.log('Tracks loaded:', tracks.length);
  console.log('Player state:', {
    isLoading,
    error,
    currentTrackIndex
  });
  console.groupEnd();
}, [currentTrack, tracks.length, isLoading, error, currentTrackIndex]);

// Add integration health check
const checkIntegrationHealth = useCallback(async () => {
  const health = {
    spotifyConnected: spotifyAuth.isAuthenticated(),
    tracksLoaded: tracks.length > 0,
    youtubeSearchAvailable: true, // Will be tested with actual search
    currentTrackValid: currentTrack && currentTrack.name && currentTrack.artists
  };
  
  console.log('Integration health check:', health);
  return health;
}, [tracks.length, currentTrack]);

// Use in development
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    checkIntegrationHealth();
  }
}, [checkIntegrationHealth, currentTrack]);
```

**Performance Monitoring**:
```typescript
// Add performance monitoring for search integration
const trackVideoSearchPerformance = useCallback((track: Track) => {
  const startTime = performance.now();
  
  return {
    onSearchStart: () => {
      console.time(`Video search: ${track.name}`);
    },
    onSearchComplete: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.timeEnd(`Video search: ${track.name}`);
      
      // Log performance metrics
      if (duration > 5000) { // Alert if search takes > 5 seconds
        console.warn('Slow video search detected:', {
          track: track.name,
          duration: `${duration.toFixed(0)}ms`
        });
      }
    }
  };
}, []);
```

## Integration Requirements

### Service Orchestration
```typescript
// Create main orchestration service to coordinate all components
interface VideoSearchOrchestrator {
  findBestVideo(track: Track): Promise<FilteredVideoResult | null>;
  findAlternativeVideos(track: Track, exclude?: string[]): Promise<FilteredVideoResult[]>;
  getVideoQuality(videoId: string): Promise<VideoQualityInfo>;
  clearCache(): void;
}

class VideoSearchOrchestrator {
  constructor(
    private youtubeService: YouTubeService,
    private searchService: YouTubeSearchService,
    private qualityService: VideoQualityService,
    private filterService: ContentFilterService
  ) {}
  
  async findBestVideo(track: Track): Promise<FilteredVideoResult | null> {
    return this.youtubeService.searchForTrackWithFallbacks(track);
  }
  
  async findAlternativeVideos(track: Track, exclude: string[] = []): Promise<FilteredVideoResult[]> {
    return this.youtubeService.searchForTrackAlternatives(track, {
      excludeVideoIds: exclude,
      maxResults: 5,
      minQualityScore: 40,
      minRelevanceScore: 50
    });
  }
}

// Export singleton instance
export const videoSearchOrchestrator = new VideoSearchOrchestrator(
  youtubeService,
  new YouTubeSearchService(),
  new VideoQualityService(), 
  new ContentFilterService()
);
```

### Type Definitions Update
```typescript
// Update existing types to include new search functionality
export interface MediaItem {
  id: string;
  type: 'youtube' | 'image';
  url: string;
  title?: string;
  thumbnail?: string;
  // NEW - Additional metadata
  qualityScore?: number;
  relevanceScore?: number;
  resolutionLevel?: ResolutionLevel;
  channelName?: string;
  duration?: string;
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
```

## Testing Requirements

### Agent 3A Tests:
- YouTube service integration with all core services
- Search fallback strategies work correctly
- Error handling covers all scenarios
- Performance meets requirements (<3s average search)

### Agent 3B Tests:
- AudioPlayer correctly passes track data to MediaCollage
- Track changes trigger appropriate video searches
- Integration works with existing Spotify functionality
- No regressions in existing audio player features

## Success Criteria

### Agent 3A Success Metrics:
- YouTube service successfully integrates all search functionality
- Search success rate >90% for popular tracks
- Fallback strategies handle edge cases gracefully
- Performance optimizations keep searches under 3 seconds

### Agent 3B Success Metrics:
- MediaCollage successfully re-integrated into AudioPlayer
- Track selection triggers appropriate video searches
- No impact on existing audio playback functionality
- Seamless user experience between audio and video

## Dependencies

- **Epic 1**: Must be fully completed (all core services implemented)
- **Epic 2**: Must be fully completed (MediaCollage refactored)
- **Agent 3A**: Can start immediately after Epic 1 & 2 completion
- **Agent 3B**: Can start Task 3B1-3B2 after Epic 2, needs 3A completion for 3B3-3B4
- **Epic 4**: Depends on completion of Epic 3