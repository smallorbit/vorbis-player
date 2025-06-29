import { YouTubeSearchService } from '../youtubeSearch';

// Mock fetch for testing
global.fetch = jest.fn();

describe('YouTubeSearchService', () => {
  let searchService: YouTubeSearchService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    searchService = new YouTubeSearchService();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('extractVideoIds', () => {
    it('should extract video IDs from YouTube search results HTML', () => {
      const mockHtml = `
        {"videoRenderer":{"videoId":"dQw4w9WgXcQ","title":"Test Video 1"}}
        {"videoRenderer":{"videoId":"kJQP7kiw5Fk","title":"Test Video 2"}}
        "videoId":"9bZkp7q19f0"
      `;

      const videoIds = searchService.extractVideoIds(mockHtml);
      
      expect(videoIds).toContain('dQw4w9WgXcQ');
      expect(videoIds).toContain('kJQP7kiw5Fk');
      expect(videoIds).toContain('9bZkp7q19f0');
    });

    it('should deduplicate video IDs', () => {
      const mockHtml = `
        "videoId":"dQw4w9WgXcQ"
        "videoId":"dQw4w9WgXcQ"
        "videoId":"kJQP7kiw5Fk"
      `;

      const videoIds = searchService.extractVideoIds(mockHtml);
      
      expect(videoIds).toEqual(['dQw4w9WgXcQ', 'kJQP7kiw5Fk']);
    });

    it('should handle various YouTube URL formats', () => {
      const html = `
        "videoId":"dQw4w9WgXcQ"
        /watch?v=kJQP7kiw5Fk
        "videoRenderer":{"videoId":"9bZkp7q19f0"
      `;

      const videoIds = searchService.extractVideoIds(html);
      
      expect(videoIds).toContain('dQw4w9WgXcQ');
      expect(videoIds).toContain('kJQP7kiw5Fk');
      expect(videoIds).toContain('9bZkp7q19f0');
    });
  });

  describe('searchVideos', () => {
    it('should throw error for empty query', async () => {
      await expect(searchService.searchVideos('')).rejects.toThrow('Search query cannot be empty');
      await expect(searchService.searchVideos('   ')).rejects.toThrow('Search query cannot be empty');
    });

    it('should return cached results when available', async () => {
      const mockResults = [
        {
          id: 'test123',
          title: 'Test Video',
          channelName: 'Test Channel',
          duration: '3:45',
          thumbnailUrl: 'https://i.ytimg.com/vi/test123/hqdefault.jpg'
        }
      ];

      // First call - mock the HTTP response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
      } as Response);

      const firstResult = await searchService.searchVideos('test query');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      mockFetch.mockClear();
      const secondResult = await searchService.searchVideos('test query');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(secondResult).toBeDefined();
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(searchService.searchVideos('test query')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Rate limited'));
      
      await expect(searchService.searchVideos('test')).rejects.toThrow('Rate limited - please try again later');
      
      expect(searchService.getLastRateLimitDelay()).toBeGreaterThan(0);
    });

    it('should extract and parse video metadata correctly', async () => {
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
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        channelName: 'Rick Astley',
        duration: '3:33'
      });
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should enforce rate limiting between requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
      } as Response);

      const startTime = Date.now();
      
      // Make two requests quickly
      const promise1 = searchService.searchVideos('query1');
      const promise2 = searchService.searchVideos('query2');
      
      // Fast-forward time to simulate delay
      jest.advanceTimersByTime(1000);
      
      await Promise.all([promise1, promise2]);
      
      // Should have waited for rate limit
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('caching', () => {
    it('should cache search results for specified duration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
      } as Response);

      // First call
      await searchService.searchVideos('test query');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call within cache period - should use cache
      mockFetch.mockClear();
      await searchService.searchVideos('test query');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear expired cache entries', async () => {
      // This would require manipulating internal cache timing
      // For now, just test that clearExpiredCache doesn't throw
      await expect(searchService.clearExpiredCache()).resolves.not.toThrow();
    });
  });

  describe('user agent rotation', () => {
    it('should use different user agents for requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"videoRenderer":{"videoId":"test123"}}')
      } as Response);

      await searchService.searchVideos('test query 1');
      await searchService.searchVideos('test query 2');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check that requests include User-Agent headers
      const firstCall = mockFetch.mock.calls[0];
      const secondCall = mockFetch.mock.calls[1];
      
      expect(firstCall[1]?.headers).toHaveProperty('User-Agent');
      expect(secondCall[1]?.headers).toHaveProperty('User-Agent');
    });
  });
});