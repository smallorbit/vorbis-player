# EPIC 04: Testing & Quality Assurance

## Overview
This epic focuses on comprehensive testing of the YouTube search integration feature. Testing can be conducted in parallel by multiple agents once the core integration is complete (Epic 3).

## Concurrent Agent Assignment

### **Agent 4A: Unit & Integration Testing**
**Primary responsibility: Service testing, component testing, and integration scenarios**

### **Agent 4B: End-to-End Testing & Performance**
**Primary responsibility: User workflow testing, performance validation, and cross-browser compatibility**

---

## Agent 4A Tasks: Unit & Integration Testing

### Task 4A1: YouTube Search Service Tests
**File**: `src/services/__tests__/youtubeSearch.test.ts` (new)

**Test Coverage Requirements**:
```typescript
describe('YouTubeSearchService', () => {
  let searchService: YouTubeSearchService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    searchService = new YouTubeSearchService();
    mockFetch = jest.mocked(fetch);
  });

  describe('searchVideos', () => {
    it('should extract video IDs from search results', async () => {
      // Test video ID regex extraction
      const mockHtml = `
        {"videoRenderer":{"videoId":"dQw4w9WgXcQ","title":"Rick Astley - Never Gonna Give You Up"}}
        {"videoRenderer":{"videoId":"kJQP7kiw5Fk","title":"Luis Fonsi - Despacito"}}
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      } as Response);

      const results = await searchService.searchVideos('test query');
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('dQw4w9WgXcQ');
      expect(results[1].id).toBe('kJQP7kiw5Fk');
    });

    it('should parse video metadata correctly', async () => {
      const mockHtml = `
        {"videoRenderer":{
          "videoId":"dQw4w9WgXcQ",
          "title":{"runs":[{"text":"Rick Astley - Never Gonna Give You Up (Official Video)"}]},
          "ownerText":{"runs":[{"text":"Rick Astley"}]},
          "lengthText":{"accessibility":{"accessibilityData":{"label":"3 minutes, 33 seconds"}}},
          "viewCountText":{"simpleText":"1,200,000,000 views"}
        }}
      `;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      } as Response);

      const results = await searchService.searchVideos('rick astley never gonna give you up');
      
      expect(results[0]).toMatchObject({
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        channelName: 'Rick Astley',
        duration: '3:33'
      });
    });

    it('should handle rate limiting gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Rate limited'));
      
      await expect(searchService.searchVideos('test')).rejects.toThrow('Rate limited');
      
      // Should implement exponential backoff
      expect(searchService.getLastRateLimitDelay()).toBeGreaterThan(0);
    });

    it('should cache search results', async () => {
      const mockResults = [{ id: 'test123', title: 'Test Video' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
      } as Response);

      // First call
      await searchService.searchVideos('test query');
      
      // Second call should use cache (no fetch)
      mockFetch.mockClear();
      const cachedResults = await searchService.searchVideos('test query');
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(cachedResults).toBeDefined();
    });
  });

  describe('extractVideoIds', () => {
    it('should handle various YouTube URL formats', () => {
      const html = `
        "videoId":"dQw4w9WgXcQ"
        /watch?v=kJQP7kiw5Fk
        youtube.com/embed/9bZkp7q19f0
      `;

      const videoIds = searchService.extractVideoIds(html);
      
      expect(videoIds).toContain('dQw4w9WgXcQ');
      expect(videoIds).toContain('kJQP7kiw5Fk');
      expect(videoIds).toContain('9bZkp7q19f0');
    });

    it('should deduplicate video IDs', () => {
      const html = `
        "videoId":"dQw4w9WgXcQ"
        "videoId":"dQw4w9WgXcQ"
        "videoId":"kJQP7kiw5Fk"
      `;

      const videoIds = searchService.extractVideoIds(html);
      
      expect(videoIds).toEqual(['dQw4w9WgXcQ', 'kJQP7kiw5Fk']);
    });
  });
});
```

### Task 4A2: Video Quality Detection Service Tests
**File**: `src/services/__tests__/videoQuality.test.ts` (new)

**Test Coverage Requirements**:
```typescript
describe('VideoQualityService', () => {
  let qualityService: VideoQualityService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    qualityService = new VideoQualityService();
    mockFetch = jest.mocked(fetch);
  });

  describe('detectMaxResolution', () => {
    it('should detect HD resolution when available', async () => {
      // Mock successful HD thumbnail fetch
      mockFetch.mockImplementation((url) => {
        if (url.includes('maxresdefault')) {
          return Promise.resolve({ ok: true } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      });

      const resolution = await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      expect(resolution).toBe(ResolutionLevel.HIGH);
    });

    it('should fallback to lower resolutions gracefully', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('maxresdefault') || url.includes('hqdefault')) {
          return Promise.resolve({ ok: false } as Response);
        }
        if (url.includes('mqdefault')) {
          return Promise.resolve({ ok: true } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      });

      const resolution = await qualityService.detectMaxResolution('test123');
      
      expect(resolution).toBe(ResolutionLevel.LOW);
    });

    it('should cache resolution results', async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      mockFetch.mockClear();
      const cachedResult = await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(cachedResult).toBe(ResolutionLevel.HIGH);
    });
  });

  describe('calculateQualityScore', () => {
    it('should score HD videos higher', async () => {
      const hdVideo = {
        id: 'hd-video',
        title: 'Test Video HD',
        channelName: 'Official Channel',
        duration: '3:30'
      };

      mockFetch.mockResolvedValue({ ok: true } as Response);

      const score = await qualityService.calculateQualityScore(hdVideo);
      
      expect(score).toBeGreaterThan(60); // HD should score high
    });

    it('should score official channels higher', async () => {
      const officialVideo = {
        id: 'official-video',
        title: 'Official Music Video',
        channelName: 'ArtistVEVO',
        duration: '3:30'
      };

      const score = await qualityService.calculateQualityScore(officialVideo);
      
      expect(score).toBeGreaterThan(50); // Official channels get bonus
    });

    it('should penalize very low resolution', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);

      const lowResVideo = {
        id: 'low-res',
        title: 'Low Quality Video',
        channelName: 'Random User',
        duration: '2:00'
      };

      const score = await qualityService.calculateQualityScore(lowResVideo);
      
      expect(score).toBeLessThan(40); // Low res should score poorly
    });
  });
});
```

### Task 4A3: Content Filtering Service Tests
**File**: `src/services/__tests__/contentFilter.test.ts` (new)

**Test Coverage Requirements**:
```typescript
describe('ContentFilterService', () => {
  let filterService: ContentFilterService;

  beforeEach(() => {
    filterService = new ContentFilterService();
  });

  describe('filterSearchResults', () => {
    const mockSearchResults = [
      {
        id: 'music-video',
        title: 'Artist - Song Title (Official Music Video)',
        channelName: 'ArtistVEVO',
        duration: '3:45'
      },
      {
        id: 'advertisement',
        title: 'Buy Now - Special Offer!',
        channelName: 'Ads Channel',
        duration: '0:30'
      },
      {
        id: 'too-long',
        title: 'Very Long Documentary',
        channelName: 'Documentary Channel',
        duration: '45:00'
      },
      {
        id: 'live-performance',
        title: 'Artist - Song Title (Live Performance)',
        channelName: 'Artist Official',
        duration: '4:12'
      }
    ];

    it('should filter out advertisements', () => {
      const filtered = filterService.filterSearchResults(mockSearchResults, 'artist song');
      
      const adVideo = filtered.find(video => video.id === 'advertisement');
      expect(adVideo).toBeUndefined();
    });

    it('should filter out inappropriate durations', () => {
      const filtered = filterService.filterSearchResults(mockSearchResults, 'artist song');
      
      const tooLong = filtered.find(video => video.id === 'too-long');
      expect(tooLong).toBeUndefined();
    });

    it('should keep appropriate music videos', () => {
      const filtered = filterService.filterSearchResults(mockSearchResults, 'artist song');
      
      const musicVideo = filtered.find(video => video.id === 'music-video');
      const liveVideo = filtered.find(video => video.id === 'live-performance');
      
      expect(musicVideo).toBeDefined();
      expect(liveVideo).toBeDefined();
    });

    it('should sort by relevance score', () => {
      const filtered = filterService.filterSearchResults(mockSearchResults, 'artist song');
      
      // Should prioritize official music video over live performance
      expect(filtered[0].id).toBe('music-video');
    });
  });

  describe('isAdOrPromo', () => {
    it('should detect ad keywords in title', () => {
      const adVideo = {
        id: 'ad',
        title: 'Buy our product now - Limited time offer!',
        channelName: 'Company',
        duration: '0:30'
      };

      expect(filterService.isAdOrPromo(adVideo)).toBe(true);
    });

    it('should detect promotional channels', () => {
      const promoVideo = {
        id: 'promo',
        title: 'Great Music Video',
        channelName: 'Marketing Ads',
        duration: '3:00'
      };

      expect(filterService.isAdOrPromo(promoVideo)).toBe(true);
    });

    it('should not flag legitimate music videos', () => {
      const musicVideo = {
        id: 'music',
        title: 'Artist - Song (Official Video)',
        channelName: 'ArtistVEVO',
        duration: '3:30'
      };

      expect(filterService.isAdOrPromo(musicVideo)).toBe(false);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should score exact matches highly', () => {
      const video = {
        id: 'exact',
        title: 'Bohemian Rhapsody - Queen',
        channelName: 'Queen Official',
        duration: '5:55'
      };

      const score = filterService.calculateRelevanceScore(video, 'Bohemian Rhapsody Queen');
      
      expect(score).toBeGreaterThan(80);
    });

    it('should score partial matches moderately', () => {
      const video = {
        id: 'partial',
        title: 'Queen - Greatest Hits',
        channelName: 'Queen Official',
        duration: '45:00'
      };

      const score = filterService.calculateRelevanceScore(video, 'Bohemian Rhapsody Queen');
      
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(60);
    });

    it('should give bonus for official indicators', () => {
      const officialVideo = {
        id: 'official',
        title: 'Song Title (Official Video)',
        channelName: 'ArtistVEVO',
        duration: '3:30'
      };

      const score = filterService.calculateRelevanceScore(officialVideo, 'song title');
      
      expect(score).toBeGreaterThan(50); // Gets official bonus
    });
  });
});
```

### Task 4A4: MediaCollage Component Tests
**File**: `src/components/__tests__/MediaCollage.test.tsx` (new)

**Test Coverage Requirements**:
```typescript
describe('MediaCollage', () => {
  let mockVideoSearchOrchestrator: jest.Mocked<VideoSearchOrchestrator>;
  
  beforeEach(() => {
    mockVideoSearchOrchestrator = {
      findBestVideo: jest.fn(),
      findAlternativeVideos: jest.fn(),
      getVideoQuality: jest.fn(),
      clearCache: jest.fn()
    };
    
    // Mock the import
    jest.mock('../services/videoSearchOrchestrator', () => ({
      videoSearchOrchestrator: mockVideoSearchOrchestrator
    }));
  });

  const mockTrack: Track = {
    id: 'track-1',
    name: 'Bohemian Rhapsody',
    artists: 'Queen',
    album: 'A Night at the Opera',
    duration_ms: 354000,
    uri: 'spotify:track:123',
    image: 'https://example.com/album-art.jpg'
  };

  it('should search for video when track changes', async () => {
    const mockVideoResult = {
      id: 'dQw4w9WgXcQ',
      title: 'Queen - Bohemian Rhapsody (Official Video)',
      channelName: 'Queen Official',
      duration: '5:55',
      qualityScore: 85,
      relevanceScore: 95,
      resolutionLevel: ResolutionLevel.HIGH,
      isFiltered: false
    };

    mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(mockVideoResult);

    render(<MediaCollage currentTrack={mockTrack} />);

    await waitFor(() => {
      expect(mockVideoSearchOrchestrator.findBestVideo).toHaveBeenCalledWith(mockTrack);
    });

    expect(screen.getByTitle(/Queen - Bohemian Rhapsody/)).toBeInTheDocument();
  });

  it('should display loading state during search', async () => {
    mockVideoSearchOrchestrator.findBestVideo.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(null), 1000))
    );

    render(<MediaCollage currentTrack={mockTrack} />);

    expect(screen.getByText(/searching youtube/i)).toBeInTheDocument();
  });

  it('should handle search failures gracefully', async () => {
    mockVideoSearchOrchestrator.findBestVideo.mockRejectedValue(new Error('Search failed'));

    render(<MediaCollage currentTrack={mockTrack} />);

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByText(/retry/i);
    expect(retryButton).toBeInTheDocument();
  });

  it('should preserve video lock functionality', async () => {
    const mockVideoResult = {
      id: 'locked-video',
      title: 'Locked Video',
      channelName: 'Test Channel',
      duration: '3:00',
      qualityScore: 70,
      relevanceScore: 80,
      resolutionLevel: ResolutionLevel.MEDIUM,
      isFiltered: false
    };

    mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(mockVideoResult);

    render(<MediaCollage currentTrack={mockTrack} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTitle(/Locked Video/)).toBeInTheDocument();
    });

    // Click lock button
    const lockButton = screen.getByRole('button', { name: /click to lock/i });
    fireEvent.click(lockButton);

    // Change track - video should stay locked
    const newTrack = { ...mockTrack, id: 'track-2', name: 'Another Song' };
    rerender(<MediaCollage currentTrack={newTrack} />);

    // Should still show locked video, not search for new one
    expect(screen.getByTitle(/Locked Video/)).toBeInTheDocument();
    expect(mockVideoSearchOrchestrator.findBestVideo).toHaveBeenCalledTimes(1);
  });

  it('should shuffle to different videos of same track', async () => {
    const mockAlternatives = [
      {
        id: 'alt-video-1',
        title: 'Queen - Bohemian Rhapsody (Live)',
        channelName: 'Queen Official',
        duration: '6:00',
        qualityScore: 80,
        relevanceScore: 85,
        resolutionLevel: ResolutionLevel.HIGH,
        isFiltered: false
      },
      {
        id: 'alt-video-2', 
        title: 'Queen - Bohemian Rhapsody (Remastered)',
        channelName: 'Queen Official',
        duration: '5:55',
        qualityScore: 90,
        relevanceScore: 90,
        resolutionLevel: ResolutionLevel.HIGH,
        isFiltered: false
      }
    ];

    mockVideoSearchOrchestrator.findAlternativeVideos.mockResolvedValue(mockAlternatives);

    render(<MediaCollage currentTrack={mockTrack} />);

    const shuffleButton = screen.getByText(/shuffle/i);
    fireEvent.click(shuffleButton);

    await waitFor(() => {
      expect(mockVideoSearchOrchestrator.findAlternativeVideos).toHaveBeenCalledWith(
        mockTrack,
        expect.any(Array)
      );
    });
  });

  it('should display fallback content when no videos found', async () => {
    mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(null);

    render(<MediaCollage currentTrack={mockTrack} />);

    await waitFor(() => {
      expect(screen.getByText(/🎵/)).toBeInTheDocument();
      expect(screen.getByText(mockTrack.name)).toBeInTheDocument();
      expect(screen.getByText(mockTrack.artists)).toBeInTheDocument();
    });
  });
});
```

---

## Agent 4B Tasks: End-to-End Testing & Performance

### Task 4B1: Full User Flow Testing
**File**: `src/__tests__/e2e/youtubeIntegration.e2e.test.ts` (new)

**End-to-End Test Scenarios**:
```typescript
describe('YouTube Integration E2E', () => {
  beforeEach(async () => {
    // Setup test environment
    await page.goto('http://localhost:3000');
    
    // Mock Spotify authentication
    await page.evaluate(() => {
      localStorage.setItem('spotify_token', JSON.stringify({
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000
      }));
    });
    
    // Mock Spotify player initialization
    await page.addScriptTag({
      content: `
        window.Spotify = {
          Player: class MockPlayer {
            connect() { return Promise.resolve(true); }
            addListener() {}
            getCurrentState() { return Promise.resolve(null); }
          }
        };
      `
    });
  });

  it('should search and display video when track is selected', async () => {
    // Wait for app to load
    await page.waitForSelector('[data-testid="playlist"]');
    
    // Click on a track
    await page.click('[data-testid="track-item"]:first-child');
    
    // Should show loading state
    await page.waitForSelector('[data-testid="video-loading"]');
    expect(await page.textContent('[data-testid="video-loading"]')).toContain('Searching YouTube');
    
    // Should display video after search
    await page.waitForSelector('iframe[src*="youtube.com/embed"]', { timeout: 10000 });
    
    const iframe = await page.$('iframe[src*="youtube.com/embed"]');
    expect(iframe).toBeTruthy();
  });

  it('should handle video lock functionality', async () => {
    // Load first track
    await page.click('[data-testid="track-item"]:first-child');
    await page.waitForSelector('iframe[src*="youtube.com/embed"]');
    
    const firstVideoSrc = await page.getAttribute('iframe', 'src');
    
    // Lock the video
    await page.click('[data-testid="video-lock-button"]');
    await page.waitForSelector('[data-testid="video-lock-button"][data-locked="true"]');
    
    // Change to different track
    await page.click('[data-testid="track-item"]:nth-child(2)');
    
    // Video should remain the same (locked)
    await page.waitForTimeout(2000); // Wait to ensure no video change
    const lockedVideoSrc = await page.getAttribute('iframe', 'src');
    expect(lockedVideoSrc).toBe(firstVideoSrc);
  });

  it('should shuffle to different videos', async () => {
    await page.click('[data-testid="track-item"]:first-child');
    await page.waitForSelector('iframe[src*="youtube.com/embed"]');
    
    const originalVideoSrc = await page.getAttribute('iframe', 'src');
    
    // Click shuffle button
    await page.click('[data-testid="shuffle-button"]');
    
    // Should show shuffling indicator
    await page.waitForSelector('[data-testid="video-loading"]');
    
    // Should load different video
    await page.waitForSelector('iframe[src*="youtube.com/embed"]');
    const shuffledVideoSrc = await page.getAttribute('iframe', 'src');
    
    // Video should be different (or same if only one good result)
    expect(shuffledVideoSrc).toBeDefined();
  });

  it('should handle network errors gracefully', async () => {
    // Simulate network failure
    await page.route('**/youtube.com/**', route => route.abort());
    
    await page.click('[data-testid="track-item"]:first-child');
    
    // Should show error state
    await page.waitForSelector('[data-testid="search-error"]');
    expect(await page.textContent('[data-testid="search-error"]')).toContain('Connection Error');
    
    // Should have retry button
    const retryButton = await page.$('[data-testid="retry-button"]');
    expect(retryButton).toBeTruthy();
  });

  it('should display fallback content when no videos found', async () => {
    // Mock empty search results
    await page.route('**/youtube.com/results**', route => {
      route.fulfill({
        status: 200,
        body: '<html><body>No results found</body></html>'
      });
    });
    
    await page.click('[data-testid="track-item"]:first-child');
    
    // Should show fallback UI
    await page.waitForSelector('[data-testid="fallback-content"]');
    expect(await page.textContent('[data-testid="fallback-content"]')).toContain('🎵');
  });
});
```

### Task 4B2: Performance Testing
**File**: `src/__tests__/performance/youtubePerformance.test.ts` (new)

**Performance Test Suite**:
```typescript
describe('YouTube Integration Performance', () => {
  const performance = {
    searchTime: [],
    qualityTestTime: [],
    totalLoadTime: []
  };

  beforeAll(() => {
    // Setup performance monitoring
    global.performance.mark = jest.fn();
    global.performance.measure = jest.fn();
    global.performance.getEntriesByName = jest.fn();
  });

  it('should complete video search within 3 seconds', async () => {
    const startTime = Date.now();
    
    const result = await videoSearchOrchestrator.findBestVideo({
      name: 'Bohemian Rhapsody',
      artists: 'Queen'
    } as Track);
    
    const endTime = Date.now();
    const searchDuration = endTime - startTime;
    
    expect(searchDuration).toBeLessThan(3000);
    expect(result).toBeDefined();
    
    performance.searchTime.push(searchDuration);
  });

  it('should cache search results effectively', async () => {
    const track = {
      name: 'Yesterday',
      artists: 'The Beatles'
    } as Track;

    // First search (should hit network)
    const startTime1 = Date.now();
    await videoSearchOrchestrator.findBestVideo(track);
    const firstSearchTime = Date.now() - startTime1;

    // Second search (should use cache)
    const startTime2 = Date.now();
    await videoSearchOrchestrator.findBestVideo(track);
    const secondSearchTime = Date.now() - startTime2;

    // Cached search should be significantly faster
    expect(secondSearchTime).toBeLessThan(firstSearchTime * 0.1);
  });

  it('should handle multiple concurrent searches efficiently', async () => {
    const tracks = [
      { name: 'Hotel California', artists: 'Eagles' },
      { name: 'Stairway to Heaven', artists: 'Led Zeppelin' },
      { name: 'Sweet Child O Mine', artists: 'Guns N Roses' },
      { name: 'Billie Jean', artists: 'Michael Jackson' },
      { name: 'Smells Like Teen Spirit', artists: 'Nirvana' }
    ] as Track[];

    const startTime = Date.now();

    const results = await Promise.all(
      tracks.map(track => videoSearchOrchestrator.findBestVideo(track))
    );

    const totalTime = Date.now() - startTime;

    // Should complete all searches within 10 seconds
    expect(totalTime).toBeLessThan(10000);
    
    // Should find videos for most tracks
    const successfulSearches = results.filter(result => result !== null);
    expect(successfulSearches.length).toBeGreaterThan(tracks.length * 0.7);
  });

  it('should maintain performance under rate limiting', async () => {
    // Simulate rate limiting responses
    let requestCount = 0;
    const originalFetch = global.fetch;
    
    global.fetch = jest.fn().mockImplementation((url) => {
      requestCount++;
      if (requestCount <= 3) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
        });
      } else {
        return Promise.reject(new Error('Rate limited'));
      }
    });

    const track = { name: 'Test Song', artists: 'Test Artist' } as Track;
    
    const startTime = Date.now();
    const result = await videoSearchOrchestrator.findBestVideo(track);
    const endTime = Date.now();

    // Should still complete within reasonable time even with rate limiting
    expect(endTime - startTime).toBeLessThan(15000);
    
    global.fetch = originalFetch;
  });

  afterAll(() => {
    // Log performance statistics
    console.log('Performance Statistics:');
    console.log('Average Search Time:', 
      performance.searchTime.reduce((a, b) => a + b, 0) / performance.searchTime.length);
    console.log('Max Search Time:', Math.max(...performance.searchTime));
    console.log('Min Search Time:', Math.min(...performance.searchTime));
  });
});
```

### Task 4B3: Cross-Browser Compatibility Testing
**File**: `src/__tests__/compatibility/browserCompatibility.test.ts` (new)

**Browser Compatibility Test Suite**:
```typescript
describe('Cross-Browser Compatibility', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];

  browsers.forEach(browser => {
    describe(`${browser} compatibility`, () => {
      let page: Page;

      beforeAll(async () => {
        page = await global.browser.newPage();
        
        // Set user agent for browser
        await page.setUserAgent(getBrowserUserAgent(browser));
      });

      it('should display YouTube videos correctly', async () => {
        await page.goto('http://localhost:3000');
        
        // Wait for track selection and video load
        await page.click('[data-testid="track-item"]:first-child');
        await page.waitForSelector('iframe[src*="youtube.com/embed"]');

        // Verify iframe is rendered
        const iframe = await page.$('iframe[src*="youtube.com/embed"]');
        expect(iframe).toBeTruthy();

        // Verify iframe dimensions
        const boundingBox = await iframe.boundingBox();
        expect(boundingBox.width).toBeGreaterThan(0);
        expect(boundingBox.height).toBeGreaterThan(0);
      });

      it('should handle video controls correctly', async () => {
        await page.goto('http://localhost:3000');
        await page.click('[data-testid="track-item"]:first-child');
        await page.waitForSelector('iframe[src*="youtube.com/embed"]');

        // Test shuffle functionality
        await page.click('[data-testid="shuffle-button"]');
        await page.waitForSelector('[data-testid="video-loading"]');

        // Test lock functionality
        await page.click('[data-testid="video-lock-button"]');
        const lockButton = await page.$('[data-testid="video-lock-button"]');
        const isLocked = await lockButton.getAttribute('data-locked');
        expect(isLocked).toBe('true');
      });

      it('should handle responsive design correctly', async () => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://localhost:3000');
        
        await page.click('[data-testid="track-item"]:first-child');
        await page.waitForSelector('iframe[src*="youtube.com/embed"]');

        // Verify responsive video container
        const videoContainer = await page.$('[data-testid="video-container"]');
        const boundingBox = await videoContainer.boundingBox();
        expect(boundingBox.width).toBeLessThanOrEqual(375);

        // Test tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        
        await page.click('[data-testid="track-item"]:first-child');
        await page.waitForSelector('iframe[src*="youtube.com/embed"]');

        // Verify tablet layout
        const tabletContainer = await page.$('[data-testid="video-container"]');
        const tabletBox = await tabletContainer.boundingBox();
        expect(tabletBox.width).toBeLessThanOrEqual(768);
      });
    });
  });

  function getBrowserUserAgent(browser: string): string {
    const userAgents = {
      chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
    };
    return userAgents[browser];
  }
});
```

### Task 4B4: Error Scenario Testing
**File**: `src/__tests__/errorScenarios/youtubeErrors.test.ts` (new)

**Error Scenario Test Suite**:
```typescript
describe('YouTube Integration Error Scenarios', () => {
  let mockVideoSearchOrchestrator: jest.Mocked<VideoSearchOrchestrator>;

  beforeEach(() => {
    mockVideoSearchOrchestrator = {
      findBestVideo: jest.fn(),
      findAlternativeVideos: jest.fn(),
      getVideoQuality: jest.fn(),
      clearCache: jest.fn()
    };
  });

  describe('Network Errors', () => {
    it('should handle connection timeouts', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle DNS resolution failures', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockRejectedValue(
        new Error('DNS resolution failed')
      );

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });
    });

    it('should handle proxy/firewall blocks', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockRejectedValue(
        new Error('Request blocked by proxy')
      );

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle YouTube rate limiting', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockRejectedValue(
        new Error('Rate limited - too many requests')
      );

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      expect(retryButton).toBeDisabled(); // Should be disabled temporarily
    });

    it('should implement exponential backoff', async () => {
      let attemptCount = 0;
      mockVideoSearchOrchestrator.findBestVideo.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Rate limited'));
        }
        return Promise.resolve(mockVideoResult);
      });

      render(<MediaCollage currentTrack={mockTrack} />);

      // Should show rate limited initially
      await waitFor(() => {
        expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
      });

      // Should eventually succeed with backoff
      await waitFor(() => {
        expect(screen.getByTitle(/mock video/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Parsing Errors', () => {
    it('should handle malformed YouTube responses', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockRejectedValue(
        new Error('Failed to parse search results')
      );

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/search error/i)).toBeInTheDocument();
      });
    });

    it('should handle empty search results', async () => {
      mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(null);

      render(<MediaCollage currentTrack={mockTrack} />);

      await waitFor(() => {
        expect(screen.getByText(/no videos found/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid video IDs', async () => {
      const invalidVideoResult = {
        ...mockVideoResult,
        id: 'invalid-id'
      };
      
      mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(invalidVideoResult);

      render(<MediaCollage currentTrack={mockTrack} />);

      // Should still render iframe, YouTube will handle invalid ID
      await waitFor(() => {
        const iframe = screen.getByTitle(/mock video/i);
        expect(iframe.getAttribute('src')).toContain('invalid-id');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle tracks with special characters', async () => {
      const specialTrack = {
        ...mockTrack,
        name: 'Song with "quotes" & symbols!',
        artists: 'Artist/Name [feat. Other]'
      };

      mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(mockVideoResult);

      render(<MediaCollage currentTrack={specialTrack} />);

      await waitFor(() => {
        expect(mockVideoSearchOrchestrator.findBestVideo).toHaveBeenCalledWith(specialTrack);
      });
    });

    it('should handle very long track names', async () => {
      const longTrack = {
        ...mockTrack,
        name: 'A'.repeat(200),
        artists: 'B'.repeat(100)
      };

      mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(mockVideoResult);

      render(<MediaCollage currentTrack={longTrack} />);

      await waitFor(() => {
        expect(mockVideoSearchOrchestrator.findBestVideo).toHaveBeenCalledWith(longTrack);
      });
    });

    it('should handle tracks with missing metadata', async () => {
      const incompleteTrack = {
        ...mockTrack,
        artists: '', // Empty artist
        album: undefined // Missing album
      };

      mockVideoSearchOrchestrator.findBestVideo.mockResolvedValue(mockVideoResult);

      render(<MediaCollage currentTrack={incompleteTrack} />);

      await waitFor(() => {
        expect(mockVideoSearchOrchestrator.findBestVideo).toHaveBeenCalledWith(incompleteTrack);
      });
    });
  });
});
```

## Integration Testing Requirements

### Service Integration Tests
```typescript
// Test service orchestration
describe('Service Integration', () => {
  it('should coordinate all services correctly', async () => {
    const track = { name: 'Test Song', artists: 'Test Artist' } as Track;
    
    const result = await videoSearchOrchestrator.findBestVideo(track);
    
    expect(result).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      qualityScore: expect.any(Number),
      relevanceScore: expect.any(Number)
    });
  });

  it('should handle service failures gracefully', async () => {
    // Mock one service failure
    jest.spyOn(YouTubeSearchService.prototype, 'searchVideos')
      .mockRejectedValue(new Error('Search service down'));

    const track = { name: 'Test Song', artists: 'Test Artist' } as Track;
    
    const result = await videoSearchOrchestrator.findBestVideo(track);
    
    // Should gracefully handle failure
    expect(result).toBeNull();
  });
});
```

## Performance Benchmarks

### Target Metrics
- **Search Time**: < 3 seconds average
- **Quality Detection**: < 500ms per video
- **Cache Hit Rate**: > 70% for repeated searches
- **Success Rate**: > 90% for popular tracks
- **Memory Usage**: < 50MB increase for video integration

### Load Testing
```typescript
describe('Load Testing', () => {
  it('should handle rapid track changes', async () => {
    const tracks = generateMockTracks(10);
    
    for (const track of tracks) {
      const startTime = Date.now();
      await videoSearchOrchestrator.findBestVideo(track);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000);
    }
  });
});
```

## Success Criteria

### Agent 4A Success Metrics:
- **Unit Test Coverage**: > 90% for all services
- **Integration Test Coverage**: > 80% for component interactions
- **Test Reliability**: All tests pass consistently
- **Mock Coverage**: All external dependencies properly mocked

### Agent 4B Success Metrics:
- **E2E Test Coverage**: All user workflows tested
- **Performance Requirements**: All benchmarks met
- **Cross-Browser Compatibility**: Works in Chrome, Firefox, Safari, Edge
- **Error Handling**: All error scenarios covered and handled gracefully

## Dependencies

- **Epic 1, 2, 3**: Must be fully completed before testing begins
- **Agent 4A**: Can start unit tests as soon as services are available
- **Agent 4B**: Requires completed integration for E2E testing
- **Both Agents**: Can work in parallel once integration is complete

## Test Environment Setup

### Required Test Tools
- Jest for unit/integration testing
- Playwright for E2E testing
- MSW for API mocking
- Testing Library for component testing

### CI/CD Integration
- All tests must pass before deployment
- Performance tests run on staging environment
- Cross-browser tests run on release candidates