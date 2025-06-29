# YouTube Integration UI Components - Integration Guide

This guide shows Agent 2A how to integrate the UI state and error handling components with the real YouTube search services.

## Components Overview

### 1. Loading States (`LoadingIndicator.tsx`)
- `LoadingIndicator` - Basic loading with progress
- `SearchPhaseIndicator` - Multi-step search process
- `VideoSkeleton` - Skeleton loading for video content

### 2. Quality Testing (`QualityTestingIndicator.tsx`)
- `QualityTestingIndicator` - Single video quality testing
- `MultiVideoQualityIndicator` - Multiple video quality comparison

### 3. Error Handling (`SearchErrorDisplay.tsx`)
- `SearchErrorDisplay` - Generic error with retry logic
- `NetworkErrorDisplay` - Network-specific errors
- `RateLimitErrorDisplay` - Rate limiting with countdown
- `NoResultsErrorDisplay` - No results with suggestions

### 4. Fallback Content (`FallbackVideoDisplay.tsx`)
- `FallbackVideoDisplay` - Album art, generated, or placeholder fallbacks
- `ManualSearchPrompt` - User-initiated search interface

## Integration Pattern for MediaCollage

```typescript
import React, { useState, useCallback } from 'react';
import {
  LoadingIndicator,
  SearchPhaseIndicator,
  QualityTestingIndicator,
  SearchErrorDisplay,
  FallbackVideoDisplay,
  type SearchError
} from './ui/youtube-integration';
import { videoSearchOrchestrator } from '../services/videoSearchOrchestrator';

const MediaCollage = ({ currentTrack, shuffleCounter }) => {
  // State management
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'testing' | 'error' | 'success'>('idle');
  const [searchPhase, setSearchPhase] = useState<'searching' | 'filtering' | 'scoring' | 'selecting'>('searching');
  const [searchError, setSearchError] = useState<SearchError | null>(null);
  const [qualityProgress, setQualityProgress] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);

  // Search function with UI state management
  const searchForVideo = useCallback(async (track: Track) => {
    if (!track) return;

    try {
      setSearchState('searching');
      setSearchError(null);
      setFallbackMode(false);

      // Phase 1: Searching
      setSearchPhase('searching');
      
      // Phase 2: Filtering  
      setSearchPhase('filtering');
      
      // Phase 3: Scoring
      setSearchPhase('scoring');
      setSearchState('testing');
      
      // Simulate quality testing progress
      for (let i = 0; i <= 4; i++) {
        setQualityProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Phase 4: Selecting
      setSearchPhase('selecting');
      
      // Call real service
      const result = await videoSearchOrchestrator.findBestVideo(track);
      
      if (result) {
        setSearchState('success');
        // Update your video display with result
        setMediaItems([{
          id: result.id,
          type: 'youtube',
          url: createYouTubeEmbedUrl(result.id),
          title: result.title
        }]);
      } else {
        // No results - show fallback
        setFallbackMode(true);
        setSearchState('success'); // Success with fallback
      }
      
    } catch (error) {
      // Handle different error types
      const searchError: SearchError = {
        type: getErrorType(error),
        message: error.message,
        retryable: true,
        retryAfter: error.retryAfter
      };
      
      setSearchError(searchError);
      setSearchState('error');
    }
  }, []);

  // Retry handlers
  const handleRetry = useCallback(() => {
    if (currentTrack) {
      searchForVideo(currentTrack);
    }
  }, [currentTrack, searchForVideo]);

  const handleSkipToFallback = useCallback(() => {
    setFallbackMode(true);
    setSearchState('success');
    setSearchError(null);
  }, []);

  // Render appropriate UI based on state
  const renderSearchUI = () => {
    switch (searchState) {
      case 'searching':
        return (
          <div className="space-y-4">
            <SearchPhaseIndicator currentPhase={searchPhase} />
            <LoadingIndicator 
              variant="search" 
              message={`${searchPhase === 'searching' ? 'Searching YouTube...' : 
                       searchPhase === 'filtering' ? 'Filtering content...' :
                       searchPhase === 'scoring' ? 'Scoring videos...' :
                       'Selecting best match...'}`}
            />
          </div>
        );

      case 'testing':
        return (
          <QualityTestingIndicator
            isActive={true}
            currentVideo={currentTrack?.name}
            totalVideos={1}
            currentProgress={qualityProgress}
            phase={qualityProgress >= 4 ? 'complete' : 'testing'}
          />
        );

      case 'error':
        return searchError ? (
          <SearchErrorDisplay
            error={searchError}
            searchQuery={`${currentTrack?.name} ${currentTrack?.artists}`}
            onRetry={handleRetry}
            onSkip={handleSkipToFallback}
          />
        ) : null;

      case 'success':
        return fallbackMode ? (
          <FallbackVideoDisplay
            track={currentTrack}
            fallbackType="album_art"
            albumArtUrl={currentTrack?.albumArt}
            onSearchRetry={handleRetry}
            onManualSearch={() => {/* Handle manual search */}}
            onSkip={() => {/* Continue with fallback */}}
          />
        ) : null; // Normal video display

      default:
        return null;
    }
  };

  return (
    <div className="media-collage">
      {searchState !== 'idle' && searchState !== 'success' ? (
        renderSearchUI()
      ) : fallbackMode ? (
        renderSearchUI() // Show fallback UI
      ) : (
        // Your normal video display
        <div className="video-container">
          {/* Normal YouTube embed or video content */}
        </div>
      )}
    </div>
  );
};
```

## Error Type Mapping

```typescript
function getErrorType(error: any): SearchErrorType {
  if (error.code === 'NETWORK_ERROR' || error.code === 'ENOTFOUND') {
    return 'network_error';
  }
  if (error.code === 'RATE_LIMIT' || error.status === 429) {
    return 'rate_limit';
  }
  if (error.code === 'NO_RESULTS' || error.message.includes('No videos found')) {
    return 'no_results';
  }
  if (error.code === 'PARSE_ERROR') {
    return 'parsing_error';
  }
  if (error.code === 'TIMEOUT') {
    return 'timeout';
  }
  return 'unknown_error';
}
```

## Testing with Mock Service

During development, you can use the mock service:

```typescript
import { mockVideoSearchOrchestrator } from '../services/__mocks__/videoSearchOrchestrator';

// Use mock service for development
const orchestrator = process.env.NODE_ENV === 'development' 
  ? mockVideoSearchOrchestrator 
  : videoSearchOrchestrator;
```

## Key Integration Points

1. **State Management**: Use the provided state patterns to manage search lifecycle
2. **Error Handling**: Map service errors to the appropriate UI error types
3. **Progress Tracking**: Update progress indicators during multi-step operations
4. **Fallback Strategy**: Always provide fallback content when search fails
5. **User Actions**: Handle retry, skip, and manual search user actions

## File Locations

- `/src/components/ui/LoadingIndicator.tsx`
- `/src/components/ui/QualityTestingIndicator.tsx`
- `/src/components/ui/SearchErrorDisplay.tsx`
- `/src/components/ui/FallbackVideoDisplay.tsx`
- `/src/components/ui/youtube-integration.tsx` (main exports)
- `/src/services/__mocks__/videoSearchOrchestrator.ts` (mock service)

## Demo Component

See `/src/components/YouTubeIntegrationDemo.tsx` for a complete working example of all UI states and interactions.