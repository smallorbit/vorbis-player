// Mock Video Search Orchestrator for UI Testing
// This mock service simulates the YouTube integration behavior for development and testing

import type { Track } from '../spotify';
import type { VideoSearchOrchestrator } from '../videoSearchOrchestrator';
import type { FilteredVideoResult } from '../contentFilter';
import type { QualityLevel } from '../../components/ui/QualityTestingIndicator';
import type { SearchError } from '../../components/ui/SearchErrorDisplay';

interface MockVideoSearchOptions {
  simulateDelay?: number;
  failureRate?: number; // 0-1, probability of failure
  errorType?: 'network' | 'rate_limit' | 'no_results' | 'parsing' | 'timeout';
  retryAfter?: number; // for rate limiting
}

class MockVideoSearchOrchestratorImpl implements VideoSearchOrchestrator {
  private options: MockVideoSearchOptions;
  private searchAttempts = new Map<string, number>();

  constructor(options: MockVideoSearchOptions = {}) {
    this.options = {
      simulateDelay: 2000,
      failureRate: 0.2,
      errorType: 'network',
      retryAfter: 30,
      ...options
    };
  }

  async findBestVideo(track: Track): Promise<FilteredVideoResult | null> {
    if (!track || !track.name) {
      throw new Error('Valid track with name is required');
    }

    const trackKey = `${track.name}-${track.artists}`;
    const attempts = this.searchAttempts.get(trackKey) || 0;
    this.searchAttempts.set(trackKey, attempts + 1);

    // Simulate delay
    await this.delay(this.options.simulateDelay || 2000);

    // Simulate failures based on failure rate
    if (Math.random() < (this.options.failureRate || 0)) {
      return this.simulateError(trackKey);
    }

    // Return mock successful result
    return this.createMockVideoResult(track);
  }

  async findAlternativeVideos(track: Track, exclude: string[] = []): Promise<FilteredVideoResult[]> {
    if (!track || !track.name) {
      return [];
    }

    await this.delay(1500);

    if (Math.random() < 0.1) { // 10% chance of no alternatives
      return [];
    }

    // Generate 3-5 alternative videos
    const count = Math.floor(Math.random() * 3) + 3;
    const alternatives: FilteredVideoResult[] = [];

    for (let i = 0; i < count; i++) {
      const mockVideo = this.createMockVideoResult(track, i + 1);
      if (mockVideo && !exclude.includes(mockVideo.id)) {
        alternatives.push(mockVideo);
      }
    }

    return alternatives;
  }

  async getVideoQuality(videoId: string): Promise<any> {
    await this.delay(800);
    return this.createMockQualityInfo(videoId);
  }

  clearCache(): void {
    this.searchAttempts.clear();
    console.log('Mock cache cleared');
  }

  // Additional mock methods for testing
  async simulateSearchWithPhases(
    track: Track,
    onPhaseChange: (phase: 'searching' | 'filtering' | 'scoring' | 'selecting') => void
  ): Promise<FilteredVideoResult | null> {
    const phases: Array<'searching' | 'filtering' | 'scoring' | 'selecting'> = [
      'searching', 'filtering', 'scoring', 'selecting'
    ];

    for (const phase of phases) {
      onPhaseChange(phase);
      await this.delay(800);
    }

    return this.findBestVideo(track);
  }

  async simulateQualityTesting(
    videoIds: string[],
    onProgress: (current: number, total: number, videoId: string, qualities: QualityLevel[]) => void
  ): Promise<QualityLevel[]> {
    const allQualities: QualityLevel[] = [];

    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      const qualities = this.createMockQualityLevels();
      
      // Simulate testing each quality level
      for (let j = 0; j < qualities.length; j++) {
        await this.delay(200);
        qualities[j].tested = true;
        qualities[j].available = Math.random() > 0.3; // 70% chance available
        if (qualities[j].available) {
          qualities[j].score = Math.floor(Math.random() * 40) + 40; // 40-80 score
        }
      }

      allQualities.push(...qualities);
      onProgress(i + 1, videoIds.length, videoId, qualities);
    }

    return allQualities;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private simulateError(trackKey: string): never {
    const attempts = this.searchAttempts.get(trackKey) || 0;
    
    // Different errors based on attempt count
    if (attempts === 1) {
      const error: SearchError = {
        type: this.options.errorType || 'network',
        message: this.getErrorMessage(this.options.errorType || 'network'),
        retryable: true,
        retryAfter: this.options.errorType === 'rate_limit' ? this.options.retryAfter : undefined
      };
      throw error;
    } else if (attempts === 2) {
      const error: SearchError = {
        type: 'no_results',
        message: 'No videos found after retry',
        retryable: true
      };
      throw error;
    } else {
      const error: SearchError = {
        type: 'timeout',
        message: 'Request timed out after multiple attempts',
        retryable: true
      };
      throw error;
    }
  }

  private getErrorMessage(errorType: string): string {
    switch (errorType) {
      case 'network':
        return 'Network connection failed';
      case 'rate_limit':
        return 'Rate limit exceeded - too many requests';
      case 'no_results':
        return 'No videos found for this search';
      case 'parsing':
        return 'Failed to parse YouTube search results';
      case 'timeout':
        return 'Request timeout - server took too long to respond';
      default:
        return 'Unknown error occurred';
    }
  }

  private createMockVideoResult(track: Track, variant: number = 0): FilteredVideoResult | null {
    const titles = [
      `${track.name} - ${track.artists} (Official Music Video)`,
      `${track.name} by ${track.artists} [HD]`,
      `${track.artists} - ${track.name} (Live Performance)`,
      `${track.name} - ${track.artists} (Audio Only)`,
      `${track.artists}: ${track.name} [Official]`
    ];

    const channels = [
      `${track.artists}Official`,
      'VevoChannel',
      'MusicVideoHD',
      `${track.artists.split(' ')[0]}Records`,
      'OfficialMusicVideos'
    ];

    const mockId = `mock_${track.name.replace(/\s+/g, '_')}_${variant}`;

    return {
      id: mockId,
      title: titles[variant % titles.length],
      description: `Official music video for "${track.name}" by ${track.artists}`,
      channelName: channels[variant % channels.length],
      channelId: `UC${mockId}`,
      publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      thumbnailUrl: `https://i.ytimg.com/vi/${mockId}/hqdefault.jpg`,
      duration: Math.floor(Math.random() * 240) + 120, // 2-6 minutes
      viewCount: Math.floor(Math.random() * 10000000) + 100000, // 100k-10M views
      qualityScore: Math.floor(Math.random() * 40) + 50, // 50-90
      relevanceScore: Math.floor(Math.random() * 30) + 60, // 60-90
      combinedScore: 0, // Will be calculated
      isFiltered: false
    };
  }

  private createMockQualityInfo(videoId: string) {
    return {
      videoId,
      availableQualities: ['240p', '360p', '480p', '720p', '1080p'],
      recommendedQuality: '720p',
      qualityScore: Math.floor(Math.random() * 40) + 50,
      metadata: {
        duration: Math.floor(Math.random() * 240) + 120,
        aspectRatio: '16:9',
        fps: Math.random() > 0.5 ? 30 : 60
      }
    };
  }

  private createMockQualityLevels(): QualityLevel[] {
    return [
      {
        resolution: '1080p',
        label: 'Full HD (1080p)',
        score: 0,
        tested: false,
        available: false
      },
      {
        resolution: '720p',
        label: 'HD (720p)',
        score: 0,
        tested: false,
        available: false
      },
      {
        resolution: '480p',
        label: 'SD (480p)',
        score: 0,
        tested: false,
        available: false
      },
      {
        resolution: '360p',
        label: 'Low (360p)',
        score: 0,
        tested: false,
        available: false
      }
    ];
  }

  // Configuration methods for testing different scenarios
  setFailureRate(rate: number): void {
    this.options.failureRate = Math.max(0, Math.min(1, rate));
  }

  setErrorType(type: 'network' | 'rate_limit' | 'no_results' | 'parsing' | 'timeout'): void {
    this.options.errorType = type;
  }

  setDelay(ms: number): void {
    this.options.simulateDelay = Math.max(0, ms);
  }

  resetAttempts(): void {
    this.searchAttempts.clear();
  }

  getAttemptCount(track: Track): number {
    const trackKey = `${track.name}-${track.artists}`;
    return this.searchAttempts.get(trackKey) || 0;
  }
}

// Export mock instance with different configurations
export const mockVideoSearchOrchestrator = new MockVideoSearchOrchestratorImpl();

// Specific mock instances for testing different scenarios
export const mockNetworkErrorOrchestrator = new MockVideoSearchOrchestratorImpl({
  failureRate: 1,
  errorType: 'network',
  simulateDelay: 1000
});

export const mockRateLimitOrchestrator = new MockVideoSearchOrchestratorImpl({
  failureRate: 1,
  errorType: 'rate_limit',
  retryAfter: 10,
  simulateDelay: 500
});

export const mockNoResultsOrchestrator = new MockVideoSearchOrchestratorImpl({
  failureRate: 1,
  errorType: 'no_results',
  simulateDelay: 1500
});

export const mockFastOrchestrator = new MockVideoSearchOrchestratorImpl({
  failureRate: 0,
  simulateDelay: 300
});

export const mockSlowOrchestrator = new MockVideoSearchOrchestratorImpl({
  failureRate: 0,
  simulateDelay: 5000
});

// Mock track data for testing
export const mockTracks: Track[] = [
  {
    name: 'Bohemian Rhapsody',
    artists: 'Queen',
    album: 'A Night at the Opera',
    duration: 355000,
    uri: 'spotify:track:mock1',
    id: 'mock1'
  },
  {
    name: 'Hotel California',
    artists: 'Eagles',
    album: 'Hotel California',
    duration: 391000,
    uri: 'spotify:track:mock2',
    id: 'mock2'
  },
  {
    name: 'Stairway to Heaven',
    artists: 'Led Zeppelin',
    album: 'Led Zeppelin IV',
    duration: 482000,
    uri: 'spotify:track:mock3',
    id: 'mock3'
  },
  {
    name: 'Imagine',
    artists: 'John Lennon',
    album: 'Imagine',
    duration: 183000,
    uri: 'spotify:track:mock4',
    id: 'mock4'
  }
];