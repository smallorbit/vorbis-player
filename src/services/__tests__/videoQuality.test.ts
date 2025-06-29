import { VideoQualityService, ResolutionLevel } from '../videoQuality';
import type { VideoSearchResult } from '../youtubeSearch';

// Mock fetch for testing
global.fetch = jest.fn();

describe('VideoQualityService', () => {
  let qualityService: VideoQualityService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    qualityService = new VideoQualityService();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('detectMaxResolution', () => {
    it('should detect HD resolution when available', async () => {
      // Mock successful HD thumbnail fetch
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('maxresdefault')) {
          return Promise.resolve({ ok: true, status: 200 } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      const resolution = await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      expect(resolution).toBe(ResolutionLevel.HIGH);
    });

    it('should fallback to lower resolutions gracefully', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('maxresdefault') || url.includes('hqdefault')) {
            return Promise.resolve({ ok: false, status: 404 } as Response);
          }
          if (url.includes('mqdefault')) {
            return Promise.resolve({ ok: true, status: 200 } as Response);
          }
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      const resolution = await qualityService.detectMaxResolution('test123');
      
      expect(resolution).toBe(ResolutionLevel.LOW);
    });

    it('should cache resolution results', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      mockFetch.mockClear();
      const cachedResult = await qualityService.detectMaxResolution('dQw4w9WgXcQ');
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(cachedResult).toBe(ResolutionLevel.HIGH);
    });

    it('should handle invalid video IDs', async () => {
      const resolution = await qualityService.detectMaxResolution('invalid');
      expect(resolution).toBe(ResolutionLevel.VERY_LOW);
      
      const emptyResolution = await qualityService.detectMaxResolution('');
      expect(emptyResolution).toBe(ResolutionLevel.VERY_LOW);
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 100)
        )
      );

      const resolution = await qualityService.detectMaxResolution('test123');
      expect(resolution).toBe(ResolutionLevel.VERY_LOW);
    });
  });

  describe('testThumbnailAvailability', () => {
    it('should return true for available thumbnails', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const isAvailable = await qualityService.testThumbnailAvailability('dQw4w9WgXcQ', 'hqdefault');
      
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.objectContaining({
            'User-Agent': expect.any(String)
          })
        })
      );
    });

    it('should return false for unavailable thumbnails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const isAvailable = await qualityService.testThumbnailAvailability('test123', 'maxresdefault');
      
      expect(isAvailable).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const isAvailable = await qualityService.testThumbnailAvailability('test123', 'hqdefault');
      
      expect(isAvailable).toBe(false);
    });
  });

  describe('calculateQualityScore', () => {
    const createMockVideo = (overrides: Partial<VideoSearchResult> = {}): VideoSearchResult => ({
      id: 'test123',
      title: 'Test Video',
      channelName: 'Test Channel',
      duration: '3:30',
      thumbnailUrl: 'https://i.ytimg.com/vi/test123/hqdefault.jpg',
      ...overrides
    });

    it('should score HD videos higher', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const hdVideo = createMockVideo({
        title: 'Test Video HD',
        channelName: 'Official Channel'
      });

      const score = await qualityService.calculateQualityScore(hdVideo);
      
      expect(score).toBeGreaterThan(60); // HD should score high
    });

    it('should score official channels higher', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const officialVideo = createMockVideo({
        title: 'Official Music Video',
        channelName: 'ArtistVEVO'
      });

      const score = await qualityService.calculateQualityScore(officialVideo);
      
      expect(score).toBeGreaterThan(50); // Official channels get bonus
    });

    it('should penalize very low resolution', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const lowResVideo = createMockVideo({
        title: 'Low Quality Video',
        channelName: 'Random User'
      });

      const score = await qualityService.calculateQualityScore(lowResVideo);
      
      expect(score).toBeLessThan(40); // Low res should score poorly
    });

    it('should give bonus for quality indicators in title', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const qualityVideo = createMockVideo({
        title: 'Song Title 4K Official Video Remastered',
        channelName: 'Test Channel'
      });

      const score = await qualityService.calculateQualityScore(qualityVideo);
      
      expect(score).toBeGreaterThan(25); // Should get title quality bonus
    });

    it('should handle high view counts', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const popularVideo = createMockVideo({
        viewCount: 50000000, // 50 million views
        duration: '3:45' // Good duration for music
      });

      const score = await qualityService.calculateQualityScore(popularVideo);
      
      expect(score).toBeGreaterThan(15); // Should get popularity bonus
    });
  });

  describe('getVideoQualityInfo', () => {
    it('should return comprehensive quality information', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      const qualityInfo = await qualityService.getVideoQualityInfo('dQw4w9WgXcQ');
      
      expect(qualityInfo).toMatchObject({
        videoId: 'dQw4w9WgXcQ',
        resolutionLevel: ResolutionLevel.HIGH,
        qualityScore: expect.any(Number),
        thumbnailUrls: {
          maxres: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          hq: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          mq: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          default: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg'
        }
      });
    });
  });

  describe('caching', () => {
    it('should cache resolution results to avoid repeated testing', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

      // First call
      await qualityService.detectMaxResolution('test123');
      expect(mockFetch).toHaveBeenCalled();

      // Second call should use cache
      mockFetch.mockClear();
      const cachedResult = await qualityService.detectMaxResolution('test123');
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(cachedResult).toBe(ResolutionLevel.HIGH);
    });

    it('should provide cache management methods', () => {
      expect(qualityService.getCacheSize()).toBe(0);
      
      qualityService.clearCache();
      expect(qualityService.getCacheSize()).toBe(0);
    });
  });

  describe('quality scoring factors', () => {
    const createMockVideo = (overrides: Partial<VideoSearchResult> = {}): VideoSearchResult => ({
      id: 'test123',
      title: 'Test Video',
      channelName: 'Test Channel',
      duration: '3:30',
      thumbnailUrl: 'https://i.ytimg.com/vi/test123/hqdefault.jpg',
      ...overrides
    });

    it('should score VEVO channels highly', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const vevoVideo = createMockVideo({
        channelName: 'ArtistVEVO'
      });

      const score = await qualityService.calculateQualityScore(vevoVideo);
      expect(score).toBeGreaterThan(20);
    });

    it('should score appropriate durations higher', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const goodDurationVideo = createMockVideo({
        duration: '3:45' // Good for music videos
      });

      const badDurationVideo = createMockVideo({
        duration: '45:00' // Too long for music
      });

      const goodScore = await qualityService.calculateQualityScore(goodDurationVideo);
      const badScore = await qualityService.calculateQualityScore(badDurationVideo);

      expect(goodScore).toBeGreaterThan(badScore);
    });
  });
});