# EPIC 02: UI Components Update

## Overview
This epic focuses on updating the user interface components to integrate with the new YouTube search functionality. Some tasks can begin in parallel with Epic 1 using mock services, while others require completed core services.

## Concurrent Agent Assignment

### **Agent 2A: MediaCollage Component Refactoring**
**Primary responsibility: Core component logic and search integration**

### **Agent 2B: UI States & Error Handling**
**Primary responsibility: Loading states, error handling, and user feedback**

---

## Agent 2A Tasks: MediaCollage Component Refactoring

### Task 2A1: Remove Static Video Mode System
**File**: `src/components/MediaCollage.tsx`

**Current State Analysis**:
```typescript
// Current video mode system to remove:
type VideoMode = '80sTV' | '90sTV';
const [videoMode, setVideoMode] = useState<VideoMode>();
const videoIds = await youtubeService.loadVideoIdsFromCategory(videoMode);
```

**Refactoring Requirements**:
1. **Remove VideoMode type and related state**
2. **Remove mode toggle UI elements** (8️⃣0️⃣s ⓽⓪s buttons)
3. **Remove static JSON file loading** (`loadVideoIdsFromCategory`)
4. **Update component props** to focus on current track

**New Component Interface**:
```typescript
interface MediaCollageProps {
  currentTrack: Track | null;
  // Remove: shuffleCounter (will be replaced with internal shuffle)
}

// Remove these interfaces:
// - VideoMode type
// - Mode selection UI components
// - JSON file loading logic
```

**Implementation Steps**:
```typescript
// 1. Remove video mode state
// const [videoMode, setVideoMode] = useState<VideoMode>(); // DELETE

// 2. Remove mode-related UI
// <ToggleGroup> component and mode selection buttons // DELETE

// 3. Update header to show "Now Playing" instead of era
const getDisplayTitle = useCallback(() => {
  return currentTrack ? `Now Playing: ${currentTrack.name}` : 'No Track Selected';
}, [currentTrack]);
```

### Task 2A2: Implement Dynamic Search-Based Content Fetching
**New Search Integration**:
```typescript
interface SearchBasedMediaFetching {
  searchForCurrentTrack(track: Track): Promise<MediaItem[]>;
  handleSearchResults(results: FilteredVideoResult[]): MediaItem[];
  createSearchQuery(track: Track): string;
}
```

**Implementation**:
```typescript
const fetchMediaContent = useCallback(async (track: Track) => {
  if (!track) return;

  setMediaItems([]);
  setLoading(true);
  
  try {
    // NEW: Create search query from track data
    const searchQuery = `${track.name} ${track.artists}`;
    
    // NEW: Use search orchestrator instead of static files
    const searchResult = await videoSearchOrchestrator.findBestVideo(searchQuery);
    
    if (searchResult) {
      const video: MediaItem = {
        id: searchResult.id,
        type: 'youtube',
        url: youtubeService.createEmbedUrl(searchResult.id, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: true,
        }),
        title: searchResult.title,
        thumbnail: `https://i.ytimg.com/vi/${searchResult.id}/hqdefault.jpg`,
      };
      
      setMediaItems([video]);
      lockedVideoRef.current = video;
    } else {
      throw new Error('No suitable video found for this track');
    }
  } catch (error) {
    console.error('Error searching for video:', error);
    setMediaItems([]);
  } finally {
    setLoading(false);
  }
}, [currentTrack]); // Updated dependencies
```

### Task 2A3: Update UI to Show "Now Playing" Instead of Era Modes
**Header Component Updates**:
```typescript
// Current header (TO REPLACE):
<h3 className="text-lg font-semibold text-white">
  {getModeTitle(videoMode)}
</h3>

// New header design:
<div className="relative flex justify-between items-center mb-4">
  <div className="flex-1">
    <h3 className="text-lg font-semibold text-white">
      Now Playing
    </h3>
    {currentTrack && (
      <p className="text-sm text-white/70 mt-1 truncate">
        {currentTrack.name} • {currentTrack.artists}
      </p>
    )}
  </div>
  
  {/* Keep lock and loading indicators */}
  <div className="flex items-center gap-2">
    {/* Video Lock Toggle - PRESERVE THIS */}
    <Toggle
      pressed={lockVideoToTrack}
      onPressedChange={handleLockVideoToggle}
      // ... existing lock toggle implementation
    >
      {lockVideoToTrack ? '🔒' : '🔓'}
    </Toggle>
    
    {loading && <Skeleton className="h-5 w-5 rounded-full bg-white/20" />}
  </div>
</div>
```

**Remove Mode Selection UI**:
```typescript
// REMOVE ENTIRE BLOCK:
<ToggleGroup
  type="single"
  value={videoMode}
  onValueChange={(value) => value && handleModeChange(value as VideoMode)}
  className="bg-white/10 rounded-lg p-1"
>
  {(['80sTV', '90sTV'] as VideoMode[]).map((mode) => (
    // ... mode selection buttons
  ))}
</ToggleGroup>
```

### Task 2A4: Preserve Video Lock and Shuffle Functionality
**Lock Functionality - PRESERVE AS-IS**:
```typescript
// Keep existing lock implementation:
const [lockVideoToTrack, setLockVideoToTrack] = useState<boolean>(() => {
  const saved = localStorage.getItem('vorbis-player-lock-video');
  return saved === 'true';
});
const lockedVideoRef = useRef<MediaItem | null>(null);

// Lock behavior logic - PRESERVE
useEffect(() => {
  if (!currentTrack) return;

  if (lockVideoToTrack && lockedVideoRef.current) {
    setMediaItems([lockedVideoRef.current]);
    return;
  }

  fetchMediaContent(currentTrack);
}, [currentTrack, lockVideoToTrack, fetchMediaContent]);
```

**Enhanced Shuffle Functionality**:
```typescript
// Update shuffle to search for different videos of same song
const handleShuffleVideo = useCallback(async () => {
  if (!currentTrack) return;
  
  setInternalShuffleCounter(prev => prev + 1);
  
  // If not locked, search for alternative videos of same track
  if (!lockVideoToTrack) {
    const searchQuery = `${currentTrack.name} ${currentTrack.artists}`;
    const alternativeResults = await videoSearchOrchestrator.findTopVideos(searchQuery, 5);
    
    if (alternativeResults.length > 1) {
      // Pick a different video than current
      const currentVideoId = mediaItems[0]?.id;
      const alternatives = alternativeResults.filter(result => result.id !== currentVideoId);
      
      if (alternatives.length > 0) {
        const randomIndex = Math.floor(Math.random() * alternatives.length);
        const selectedVideo = alternatives[randomIndex];
        
        const video: MediaItem = {
          id: selectedVideo.id,
          type: 'youtube',
          url: youtubeService.createEmbedUrl(selectedVideo.id, {
            autoplay: true,
            mute: true,
            loop: true,
            controls: true,
          }),
          title: selectedVideo.title,
          thumbnail: `https://i.ytimg.com/vi/${selectedVideo.id}/hqdefault.jpg`,
        };
        
        setMediaItems([video]);
        lockedVideoRef.current = video;
      }
    }
  }
}, [currentTrack, lockVideoToTrack, mediaItems]);
```

---

## Agent 2B Tasks: UI States & Error Handling

### Task 2B1: Add Search Loading Indicators
**File**: `src/components/MediaCollage.tsx` (coordinate with Agent 2A)

**Enhanced Loading States**:
```typescript
interface LoadingState {
  isSearching: boolean;
  isQualityTesting: boolean;
  searchProgress?: string;
}

const [loadingState, setLoadingState] = useState<LoadingState>({
  isSearching: false,
  isQualityTesting: false
});
```

**Loading UI Components**:
```typescript
const LoadingIndicator = memo<{ loadingState: LoadingState }>(({ loadingState }) => {
  if (loadingState.isSearching) {
    return (
      <div className="flex items-center gap-2 text-white/70">
        <Skeleton className="h-4 w-4 rounded-full bg-white/20" />
        <span className="text-sm">
          {loadingState.searchProgress || 'Searching YouTube...'}
        </span>
      </div>
    );
  }
  
  if (loadingState.isQualityTesting) {
    return (
      <div className="flex items-center gap-2 text-white/70">
        <Skeleton className="h-4 w-4 rounded-full bg-white/20" />
        <span className="text-sm">Testing video quality...</span>
      </div>
    );
  }
  
  return null;
});
```

**Progress Updates During Search**:
```typescript
const fetchMediaContent = useCallback(async (track: Track) => {
  if (!track) return;

  setMediaItems([]);
  setLoadingState({ isSearching: true, isQualityTesting: false, searchProgress: 'Searching YouTube...' });
  
  try {
    const searchQuery = `${track.name} ${track.artists}`;
    
    // Update progress
    setLoadingState(prev => ({ ...prev, searchProgress: 'Finding videos...' }));
    
    const searchResults = await youtubeSearch.searchVideos(searchQuery);
    
    setLoadingState(prev => ({ ...prev, searchProgress: 'Testing video quality...' }));
    setLoadingState(prev => ({ ...prev, isSearching: false, isQualityTesting: true }));
    
    const bestVideo = await videoQuality.findBestQualityVideo(searchResults);
    
    // ... rest of implementation
  } catch (error) {
    // Handle errors
  } finally {
    setLoadingState({ isSearching: false, isQualityTesting: false });
  }
}, [currentTrack]);
```

### Task 2B2: Video Quality Loading States
**Quality Testing Feedback**:
```typescript
interface QualityTestingState {
  currentVideo?: string;
  testedCount: number;
  totalCount: number;
  bestQualityFound?: ResolutionLevel;
}

const QualityTestingIndicator = memo<{ state: QualityTestingState }>(({ state }) => {
  return (
    <div className="text-center text-white/70 py-4">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Skeleton className="h-4 w-4 rounded-full bg-white/20" />
        <span className="text-sm">Testing video quality...</span>
      </div>
      
      <div className="text-xs text-white/50">
        {state.testedCount} of {state.totalCount} videos tested
        {state.bestQualityFound && (
          <span className="ml-2 text-green-400">
            Best: {state.bestQualityFound.toUpperCase()}
          </span>
        )}
      </div>
      
      <div className="w-full bg-white/10 rounded-full h-1 mt-2">
        <div 
          className="bg-blue-500 h-1 rounded-full transition-all duration-300"
          style={{ width: `${(state.testedCount / state.totalCount) * 100}%` }}
        />
      </div>
    </div>
  );
});
```

### Task 2B3: Search Failure Error Handling UI
**Error State Management**:
```typescript
interface SearchError {
  type: 'network' | 'no_results' | 'rate_limited' | 'parsing_error';
  message: string;
  canRetry: boolean;
  retryAfter?: number; // seconds
}

const [searchError, setSearchError] = useState<SearchError | null>(null);
```

**Error UI Components**:
```typescript
const SearchErrorDisplay = memo<{ 
  error: SearchError; 
  onRetry: () => void;
  onSkip: () => void;
}>(({ error, onRetry, onSkip }) => {
  const getErrorIcon = (type: SearchError['type']) => {
    switch (type) {
      case 'network': return '🌐';
      case 'no_results': return '🔍';
      case 'rate_limited': return '⏰';
      case 'parsing_error': return '⚠️';
      default: return '❌';
    }
  };

  const getErrorTitle = (type: SearchError['type']) => {
    switch (type) {
      case 'network': return 'Connection Error';
      case 'no_results': return 'No Videos Found';
      case 'rate_limited': return 'Rate Limited';
      case 'parsing_error': return 'Search Error';
      default: return 'Unknown Error';
    }
  };

  return (
    <div className="text-center text-white/70 py-8">
      <div className="text-4xl mb-4">{getErrorIcon(error.type)}</div>
      <h4 className="text-lg font-semibold text-white mb-2">
        {getErrorTitle(error.type)}
      </h4>
      <p className="text-sm mb-4 max-w-sm mx-auto">
        {error.message}
      </p>
      
      <div className="flex gap-2 justify-center">
        {error.canRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            {error.retryAfter ? `Retry in ${error.retryAfter}s` : 'Retry'}
          </Button>
        )}
        
        <Button
          onClick={onSkip}
          variant="ghost"
          size="sm"
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          Skip Video
        </Button>
      </div>
    </div>
  );
});
```

### Task 2B4: Fallback Content When No Videos Found
**Fallback Strategies**:
```typescript
interface FallbackContent {
  type: 'placeholder' | 'album_art' | 'visualizer';
  content: MediaItem;
}

const generateFallbackContent = useCallback((track: Track): FallbackContent => {
  // Strategy 1: Use album art as background
  if (track.image) {
    return {
      type: 'album_art',
      content: {
        id: 'fallback-album-art',
        type: 'image',
        url: track.image,
        title: `${track.name} - Album Art`,
        thumbnail: track.image
      }
    };
  }
  
  // Strategy 2: Generate placeholder with track info
  return {
    type: 'placeholder',
    content: {
      id: 'fallback-placeholder',
      type: 'image',
      url: `https://via.placeholder.com/600x600/1a1a1a/ffffff?text=${encodeURIComponent(track.name)}`,
      title: `${track.name} by ${track.artists}`,
      thumbnail: `https://via.placeholder.com/300x300/1a1a1a/ffffff?text=${encodeURIComponent(track.name)}`
    }
  };
}, []);

const handleSearchFailure = useCallback(async (track: Track, error: SearchError) => {
  console.warn('Search failed, using fallback content:', error);
  
  const fallback = generateFallbackContent(track);
  setMediaItems([fallback.content]);
  
  // Still allow shuffle to retry search
  setSearchError(error);
}, [generateFallbackContent]);
```

**Enhanced Fallback UI**:
```typescript
const FallbackVideoDisplay = memo<{ 
  fallback: FallbackContent; 
  track: Track;
  onRetrySearch: () => void;
}>(({ fallback, track, onRetrySearch }) => {
  return (
    <AspectRatio ratio={3 / 4} className="w-full">
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-sm border border-white/20 w-full h-full">
        
        {fallback.type === 'album_art' && (
          <img
            src={fallback.content.url}
            alt={fallback.content.title}
            className="w-full h-full object-cover opacity-50"
          />
        )}
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4">🎵</div>
          <h3 className="text-white font-semibold text-lg mb-2 truncate w-full">
            {track.name}
          </h3>
          <p className="text-white/70 text-sm mb-4 truncate w-full">
            {track.artists}
          </p>
          
          <Button
            onClick={onRetrySearch}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs"
          >
            🔍 Search for Video
          </Button>
        </div>
      </div>
    </AspectRatio>
  );
});
```

## Integration Requirements

### Component Communication
```typescript
// Shared state between Agent 2A and 2B
interface MediaCollageState {
  // Core state (Agent 2A)
  mediaItems: MediaItem[];
  currentTrack: Track | null;
  lockVideoToTrack: boolean;
  
  // UI state (Agent 2B)  
  loadingState: LoadingState;
  searchError: SearchError | null;
  fallbackContent: FallbackContent | null;
}

// Shared callbacks
interface MediaCollageCallbacks {
  onSearchStart: (track: Track) => void;
  onSearchProgress: (progress: string) => void;
  onSearchSuccess: (results: MediaItem[]) => void;
  onSearchError: (error: SearchError) => void;
  onRetrySearch: () => void;
  onUseFlowback: () => void;
}
```

### Mock Services for Parallel Development
**Agent 2B can start immediately with mock services**:
```typescript
// Mock search service for UI development
const mockVideoSearchOrchestrator = {
  async findBestVideo(query: string): Promise<FilteredVideoResult | null> {
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock result or simulate various error conditions
    if (query.includes('error')) {
      throw new Error('Mock search error');
    }
    
    return {
      id: 'mock-video-id',
      title: `Mock Video for ${query}`,
      channelName: 'Mock Channel',
      duration: '3:45',
      qualityScore: 85,
      relevanceScore: 92,
      resolutionLevel: ResolutionLevel.HIGH,
      isFiltered: false
    };
  }
};
```

## Testing Requirements

### Agent 2A Tests:
- Component renders correctly without video modes
- Search integration works with real and mock services
- Lock functionality preserved during refactoring
- Shuffle generates different videos for same track

### Agent 2B Tests:
- Loading states display correctly during search phases
- Error handling covers all error scenarios
- Fallback content displays when search fails
- User can recover from error states

## Success Criteria

### Agent 2A Success Metrics:
- MediaCollage fully refactored without video mode system
- Dynamic search integration functional
- All existing functionality (lock, shuffle) preserved
- Clean, maintainable component architecture

### Agent 2B Success Metrics:
- Clear user feedback during all search phases
- Graceful error handling for all failure scenarios
- Appropriate fallback content when videos unavailable
- User can always recover or skip problematic content

## Dependencies

- **Agent 2A**: Can start Task 2A1 immediately (remove static system)
- **Agent 2A**: Tasks 2A2-2A4 require Epic 1 completion for real services
- **Agent 2B**: Can start immediately using mock services
- **Integration**: Both agents coordinate on shared component state
- **Epic 3**: Depends on completion of Epic 2