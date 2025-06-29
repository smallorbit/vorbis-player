import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import {
  LoadingIndicator,
  SearchPhaseIndicator,
  VideoSkeleton,
  QualityTestingIndicator,
  MultiVideoQualityIndicator,
  SearchErrorDisplay,
  NetworkErrorDisplay,
  RateLimitErrorDisplay,
  NoResultsErrorDisplay,
  FallbackVideoDisplay,
  ManualSearchPrompt,
  type QualityLevel,
  type SearchError
} from './ui/youtube-integration';
import {
  mockVideoSearchOrchestrator,
  mockNetworkErrorOrchestrator,
  mockRateLimitOrchestrator,
  mockNoResultsOrchestrator,
  mockFastOrchestrator,
  mockTracks,
  type MockVideoSearchOrchestratorImpl
} from '../services/__mocks__/videoSearchOrchestrator';
import type { Track } from '../services/spotify';

type DemoState = 
  | 'idle'
  | 'loading'
  | 'search-phases'
  | 'quality-testing'
  | 'multi-video-quality'
  | 'network-error'
  | 'rate-limit-error'
  | 'no-results-error'
  | 'parsing-error'
  | 'fallback-album-art'
  | 'fallback-generated'
  | 'fallback-placeholder'
  | 'manual-search'
  | 'success';

interface DemoStateConfig {
  label: string;
  description: string;
  component: React.ReactNode;
}

const YouTubeIntegrationDemo: React.FC = () => {
  const [currentState, setCurrentState] = useState<DemoState>('idle');
  const [currentTrack] = useState<Track>(mockTracks[0]);
  const [searchPhase, setSearchPhase] = useState<'searching' | 'filtering' | 'scoring' | 'selecting'>('searching');
  const [qualityProgress, setQualityProgress] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [multiVideoProgress, setMultiVideoProgress] = useState({
    videos: [
      { id: 'v1', title: 'Official Music Video', status: 'complete' as const, bestQuality: { resolution: '1080p', label: 'Full HD', score: 85, tested: true, available: true } },
      { id: 'v2', title: 'Live Performance', status: 'testing' as const },
      { id: 'v3', title: 'Audio Only', status: 'pending' as const },
      { id: 'v4', title: 'Cover Version', status: 'pending' as const }
    ]
  });

  // Auto-cycle through search phases for demo
  useEffect(() => {
    if (currentState === 'search-phases') {
      const phases: Array<'searching' | 'filtering' | 'scoring' | 'selecting'> = [
        'searching', 'filtering', 'scoring', 'selecting'
      ];
      let currentIndex = 0;

      const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % phases.length;
        setSearchPhase(phases[currentIndex]);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentState]);

  // Auto-progress quality testing for demo
  useEffect(() => {
    if (currentState === 'quality-testing') {
      const totalSteps = 4;
      let progress = 0;

      const interval = setInterval(() => {
        progress += 1;
        setQualityProgress(progress);

        // Update quality levels as they get "tested"
        const mockQualities: QualityLevel[] = [
          { resolution: '1080p', label: 'Full HD', score: progress > 3 ? 85 : 0, tested: progress > 3, available: progress > 3 },
          { resolution: '720p', label: 'HD', score: progress > 2 ? 78 : 0, tested: progress > 2, available: progress > 2 },
          { resolution: '480p', label: 'SD', score: progress > 1 ? 65 : 0, tested: progress > 1, available: progress > 1 },
          { resolution: '360p', label: 'Low', score: progress > 0 ? 45 : 0, tested: progress > 0, available: progress > 0 }
        ];

        setQualityLevels(mockQualities);

        if (progress >= totalSteps) {
          clearInterval(interval);
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [currentState]);

  // Auto-progress multi-video testing for demo
  useEffect(() => {
    if (currentState === 'multi-video-quality') {
      let currentVideoIndex = 1; // Start with second video (first is already complete)

      const interval = setInterval(() => {
        setMultiVideoProgress(prev => {
          const updated = { ...prev };
          
          if (currentVideoIndex < updated.videos.length) {
            // Complete current video
            if (updated.videos[currentVideoIndex].status === 'testing') {
              updated.videos[currentVideoIndex] = {
                ...updated.videos[currentVideoIndex],
                status: 'complete',
                bestQuality: { 
                  resolution: ['720p', '480p', '360p'][currentVideoIndex - 1], 
                  label: ['HD', 'SD', 'Low'][currentVideoIndex - 1], 
                  score: [72, 58, 42][currentVideoIndex - 1], 
                  tested: true, 
                  available: true 
                }
              };
              currentVideoIndex++;
            } else if (updated.videos[currentVideoIndex].status === 'pending') {
              // Start testing next video
              updated.videos[currentVideoIndex] = {
                ...updated.videos[currentVideoIndex],
                status: 'testing'
              };
            }
          }

          return updated;
        });

        if (currentVideoIndex >= 4) {
          clearInterval(interval);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentState]);

  const demoStates: Record<DemoState, DemoStateConfig> = {
    idle: {
      label: 'Idle',
      description: 'Ready to demonstrate YouTube integration UI states',
      component: (
        <div className="text-center p-8 text-gray-500">
          <div className="text-4xl mb-4">🎵</div>
          <p>Select a UI state from the buttons below to see it in action</p>
        </div>
      )
    },

    loading: {
      label: 'Basic Loading',
      description: 'Simple loading indicator for general YouTube search',
      component: <LoadingIndicator variant="search" message="Searching for videos..." />
    },

    'search-phases': {
      label: 'Search Phases',
      description: 'Step-by-step search process visualization',
      component: (
        <div className="space-y-4">
          <SearchPhaseIndicator currentPhase={searchPhase} />
          <LoadingIndicator variant="search" message={`Currently ${searchPhase}...`} />
        </div>
      )
    },

    'quality-testing': {
      label: 'Quality Testing',
      description: 'Video quality testing with progress and results',
      component: (
        <QualityTestingIndicator
          isActive={true}
          currentVideo="Official Music Video"
          totalVideos={1}
          currentProgress={qualityProgress}
          qualityLevels={qualityLevels}
          bestQuality={qualityLevels.find(q => q.tested && q.available && q.score === Math.max(...qualityLevels.filter(ql => ql.tested && ql.available).map(ql => ql.score)))}
          phase={qualityProgress >= 4 ? 'complete' : 'testing'}
        />
      )
    },

    'multi-video-quality': {
      label: 'Multi-Video Quality',
      description: 'Testing quality across multiple video candidates',
      component: <MultiVideoQualityIndicator videos={multiVideoProgress.videos} />
    },

    'network-error': {
      label: 'Network Error',
      description: 'Network connection failure handling',
      component: (
        <NetworkErrorDisplay
          onRetry={() => console.log('Retry clicked')}
          onSkip={() => console.log('Skip clicked')}
          details="Connection timeout after 30 seconds"
        />
      )
    },

    'rate-limit-error': {
      label: 'Rate Limit Error',
      description: 'Rate limiting with countdown timer',
      component: (
        <RateLimitErrorDisplay
          retryAfter={15}
          onRetry={() => console.log('Retry clicked')}
          onSkip={() => console.log('Skip clicked')}
        />
      )
    },

    'no-results-error': {
      label: 'No Results Error',
      description: 'No videos found with search suggestions',
      component: (
        <NoResultsErrorDisplay
          searchQuery={`${currentTrack.name} ${currentTrack.artists} official music video`}
          onRetry={() => console.log('Retry clicked')}
          onSkip={() => console.log('Skip clicked')}
          suggestions={[
            `${currentTrack.name} ${currentTrack.artists}`,
            `${currentTrack.name} official`,
            `${currentTrack.artists} live`,
            `${currentTrack.name} acoustic`
          ]}
        />
      )
    },

    'parsing-error': {
      label: 'Parsing Error',
      description: 'YouTube format parsing error',
      component: (
        <SearchErrorDisplay
          error={{
            type: 'parsing_error',
            message: 'Failed to parse search results',
            details: 'YouTube may have changed their response format',
            retryable: true
          }}
          searchQuery={`${currentTrack.name} ${currentTrack.artists}`}
          onRetry={() => console.log('Retry clicked')}
          onSkip={() => console.log('Skip clicked')}
        />
      )
    },

    'fallback-album-art': {
      label: 'Fallback: Album Art',
      description: 'Album artwork as video fallback',
      component: (
        <FallbackVideoDisplay
          track={currentTrack}
          fallbackType="album_art"
          albumArtUrl="https://i.scdn.co/image/ab67616d0000b273e319baafd16e84f0408af2a0" // Mock album art
          onSearchRetry={() => console.log('Search retry clicked')}
          onManualSearch={() => console.log('Manual search clicked')}
          onSkip={() => console.log('Skip clicked')}
        />
      )
    },

    'fallback-generated': {
      label: 'Fallback: Generated',
      description: 'Generated visual placeholder',
      component: (
        <FallbackVideoDisplay
          track={currentTrack}
          fallbackType="generated"
          onSearchRetry={() => console.log('Search retry clicked')}
          onManualSearch={() => console.log('Manual search clicked')}
          onSkip={() => console.log('Skip clicked')}
        />
      )
    },

    'fallback-placeholder': {
      label: 'Fallback: Placeholder',
      description: 'Basic placeholder when content fails',
      component: (
        <FallbackVideoDisplay
          track={currentTrack}
          fallbackType="placeholder"
          onSearchRetry={() => console.log('Search retry clicked')}
          onSkip={() => console.log('Skip clicked')}
        />
      )
    },

    'manual-search': {
      label: 'Manual Search',
      description: 'User-initiated custom search prompt',
      component: (
        <ManualSearchPrompt
          track={currentTrack}
          onSearch={(query) => console.log('Manual search:', query)}
          onCancel={() => console.log('Manual search cancelled')}
        />
      )
    },

    success: {
      label: 'Success State',
      description: 'Successful video found and loaded',
      component: (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-green-800 dark:text-green-200">
              <span className="text-xl">✅</span>
              <span className="font-semibold">Video Found Successfully!</span>
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-2">
              Found and loaded: "{currentTrack.name} - {currentTrack.artists} (Official Music Video)"
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              Quality: 720p HD • Relevance: 89% • Load time: 2.3s
            </div>
          </div>
          <VideoSkeleton count={1} />
        </div>
      )
    }
  };

  const stateCategories = {
    'Loading States': ['loading', 'search-phases', 'quality-testing', 'multi-video-quality'],
    'Error States': ['network-error', 'rate-limit-error', 'no-results-error', 'parsing-error'],
    'Fallback States': ['fallback-album-art', 'fallback-generated', 'fallback-placeholder'],
    'Interactive States': ['manual-search', 'success']
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>🎵</span>
            <span>YouTube Integration UI Demo</span>
          </CardTitle>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Interactive demonstration of all UI states and error handling for YouTube video search integration
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Current Track Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Current Track:</div>
            <div className="text-xs text-blue-600 dark:text-blue-300">
              {currentTrack.name} - {currentTrack.artists} ({currentTrack.album})
            </div>
          </div>

          {/* State Selection */}
          <div className="space-y-4">
            {Object.entries(stateCategories).map(([category, states]) => (
              <div key={category}>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {category}
                </div>
                <div className="flex flex-wrap gap-2">
                  {states.map(state => (
                    <Button
                      key={state}
                      variant={currentState === state ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentState(state as DemoState)}
                    >
                      {demoStates[state as DemoState].label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant={currentState === 'idle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentState('idle')}
              >
                Reset to Idle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current State Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{demoStates[currentState].label}</span>
            <span className="text-sm font-normal text-gray-500">
              State: {currentState}
            </span>
          </CardTitle>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {demoStates[currentState].description}
          </div>
        </CardHeader>
        
        <CardContent>
          {demoStates[currentState].component}
        </CardContent>
      </Card>

      {/* Integration Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integration Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>Components Created:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1 text-xs ml-4">
              <li><code>LoadingIndicator</code> - Search progress with phases and animations</li>
              <li><code>QualityTestingIndicator</code> - Video quality testing feedback</li>
              <li><code>SearchErrorDisplay</code> - Comprehensive error handling with retry logic</li>
              <li><code>FallbackVideoDisplay</code> - Graceful fallbacks when videos fail</li>
              <li><code>ManualSearchPrompt</code> - User-driven search interface</li>
            </ul>
          </div>
          
          <div>
            <strong>Mock Service:</strong> All components work with <code>mockVideoSearchOrchestrator</code> 
            for development and testing without real API calls.
          </div>
          
          <div>
            <strong>Ready for Integration:</strong> Agent 2A can now integrate these components 
            with the real YouTube search services in MediaCollage.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default YouTubeIntegrationDemo;