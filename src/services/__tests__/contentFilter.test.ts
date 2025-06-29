import { ContentFilterService } from '../contentFilter';
import type { VideoSearchResult } from '../youtubeSearch';

describe('ContentFilterService', () => {
  let filterService: ContentFilterService;

  beforeEach(() => {
    filterService = new ContentFilterService();
  });

  const createMockVideo = (overrides: Partial<VideoSearchResult> = {}): VideoSearchResult => ({
    id: 'test123',
    title: 'Test Video',
    channelName: 'Test Channel',
    duration: '3:30',
    thumbnailUrl: 'https://i.ytimg.com/vi/test123/hqdefault.jpg',
    ...overrides
  });

  describe('isAdOrPromo', () => {
    it('should detect ad keywords in title', () => {
      const adVideo = createMockVideo({
        title: 'Buy our product now - Limited time offer!'
      });

      expect(filterService.isAdOrPromo(adVideo)).toBe(true);
    });

    it('should detect promotional channels', () => {
      const promoVideo = createMockVideo({
        channelName: 'Marketing Ads'
      });

      expect(filterService.isAdOrPromo(promoVideo)).toBe(true);
    });

    it('should detect sponsored content indicators', () => {
      const sponsoredVideo = createMockVideo({
        title: 'Great Music Video - Sponsored Content'
      });

      expect(filterService.isAdOrPromo(sponsoredVideo)).toBe(true);
    });

    it('should not flag legitimate music videos', () => {
      const musicVideo = createMockVideo({
        title: 'Artist - Song (Official Video)',
        channelName: 'ArtistVEVO'
      });

      expect(filterService.isAdOrPromo(musicVideo)).toBe(false);
    });

    it('should detect blocked channel patterns', () => {
      const blockedChannels = [
        'FakeChannel',
        'SpamBot',
        'PromoAccount'
      ];

      blockedChannels.forEach(channelName => {
        const video = createMockVideo({ channelName });
        expect(filterService.isAdOrPromo(video)).toBe(true);
      });
    });
  });

  describe('isAppropriateLength', () => {
    it('should accept appropriate video lengths', () => {
      const appropriateDurations = ['0:45', '3:30', '5:15', '12:00'];
      
      appropriateDurations.forEach(duration => {
        expect(filterService.isAppropriateLength(duration)).toBe(true);
      });
    });

    it('should reject very short videos (likely ads)', () => {
      const shortDurations = ['0:15', '0:25', '0:05'];
      
      shortDurations.forEach(duration => {
        expect(filterService.isAppropriateLength(duration)).toBe(false);
      });
    });

    it('should reject very long videos (likely not music)', () => {
      const longDurations = ['20:00', '45:30', '1:30:00'];
      
      longDurations.forEach(duration => {
        expect(filterService.isAppropriateLength(duration)).toBe(false);
      });
    });

    it('should handle different duration formats', () => {
      expect(filterService.isAppropriateLength('3:45')).toBe(true);
      expect(filterService.isAppropriateLength('1:03:45')).toBe(false);
      expect(filterService.isAppropriateLength('')).toBe(false);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should score exact matches highly', () => {
      const video = createMockVideo({
        title: 'Bohemian Rhapsody - Queen',
        channelName: 'Queen Official'
      });

      const score = filterService.calculateRelevanceScore(video, 'Bohemian Rhapsody Queen');
      
      expect(score).toBeGreaterThan(80);
    });

    it('should score partial matches moderately', () => {
      const video = createMockVideo({
        title: 'Queen - Greatest Hits',
        channelName: 'Queen Official'
      });

      const score = filterService.calculateRelevanceScore(video, 'Bohemian Rhapsody Queen');
      
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(60);
    });

    it('should give bonus for official indicators', () => {
      const officialVideo = createMockVideo({
        title: 'Song Title (Official Video)',
        channelName: 'ArtistVEVO'
      });

      const score = filterService.calculateRelevanceScore(officialVideo, 'song title');
      
      expect(score).toBeGreaterThan(50); // Gets official bonus
    });

    it('should penalize covers and remixes', () => {
      const originalVideo = createMockVideo({
        title: 'Artist - Song Title (Official Video)'
      });

      const coverVideo = createMockVideo({
        title: 'Artist - Song Title (Cover Version)'
      });

      const originalScore = filterService.calculateRelevanceScore(originalVideo, 'artist song title');
      const coverScore = filterService.calculateRelevanceScore(coverVideo, 'artist song title');

      expect(originalScore).toBeGreaterThan(coverScore);
    });

    it('should penalize reaction videos and compilations', () => {
      const musicVideo = createMockVideo({
        title: 'Artist - Song Title (Official Video)'
      });

      const reactionVideo = createMockVideo({
        title: 'Artist - Song Title Reaction Video'
      });

      const musicScore = filterService.calculateRelevanceScore(musicVideo, 'artist song title');
      const reactionScore = filterService.calculateRelevanceScore(reactionVideo, 'artist song title');

      expect(musicScore).toBeGreaterThan(reactionScore);
    });
  });

  describe('filterSearchResults', () => {
    const mockSearchResults: VideoSearchResult[] = [
      createMockVideo({
        id: 'music-video',
        title: 'Artist - Song Title (Official Music Video)',
        channelName: 'ArtistVEVO',
        duration: '3:45'
      }),
      createMockVideo({
        id: 'advertisement',
        title: 'Buy Now - Special Offer!',
        channelName: 'Ads Channel',
        duration: '0:30'
      }),
      createMockVideo({
        id: 'too-long',
        title: 'Very Long Documentary',
        channelName: 'Documentary Channel',
        duration: '45:00'
      }),
      createMockVideo({
        id: 'live-performance',
        title: 'Artist - Song Title (Live Performance)',
        channelName: 'Artist Official',
        duration: '4:12'
      }),
      createMockVideo({
        id: 'spam-video',
        title: 'CLICK HERE!!! FREE DOWNLOAD!!!',
        channelName: 'Spam Channel',
        duration: '2:00'
      })
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

    it('should filter out spam content', () => {
      const filtered = filterService.filterSearchResults(mockSearchResults, 'artist song');
      
      const spamVideo = filtered.find(video => video.id === 'spam-video');
      expect(spamVideo).toBeUndefined();
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
      
      // Results should be sorted by relevance (highest first)
      for (let i = 0; i < filtered.length - 1; i++) {
        const current = filtered[i] as VideoSearchResult & { relevanceScore: number };
        const next = filtered[i + 1] as VideoSearchResult & { relevanceScore: number };
        expect(current.relevanceScore).toBeGreaterThanOrEqual(next.relevanceScore);
      }
    });

    it('should handle empty results gracefully', () => {
      const filtered = filterService.filterSearchResults([], 'test query');
      expect(filtered).toEqual([]);
    });
  });

  describe('createFilteredResult', () => {
    it('should create filtered result with combined score', () => {
      const video = createMockVideo({
        title: 'Test Song (Official Video)',
        channelName: 'ArtistVEVO'
      });

      const filtered = filterService.createFilteredResult(video, 'test song', 80);
      
      expect(filtered).toMatchObject({
        ...video,
        qualityScore: 80,
        relevanceScore: expect.any(Number),
        combinedScore: expect.any(Number),
        isFiltered: false
      });

      // Combined score should be weighted average (60% quality, 40% relevance)
      const expectedCombined = (80 * 0.6) + (filtered.relevanceScore * 0.4);
      expect(filtered.combinedScore).toBeCloseTo(expectedCombined, 1);
    });
  });

  describe('filterAndScoreResults', () => {
    it('should filter and score results correctly', () => {
      const results = [
        createMockVideo({
          id: 'good-video',
          title: 'Artist - Song (Official Video)',
          channelName: 'ArtistVEVO',
          duration: '3:30'
        }),
        createMockVideo({
          id: 'ad-video',
          title: 'Buy Now! Limited Offer!',
          channelName: 'Ads',
          duration: '0:15'
        })
      ];

      const qualityScores = new Map([
        ['good-video', 85],
        ['ad-video', 20]
      ]);

      const filtered = filterService.filterAndScoreResults(results, 'artist song', qualityScores);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('good-video');
      expect(filtered[0].qualityScore).toBe(85);
    });
  });

  describe('channel management', () => {
    it('should support adding to whitelist', () => {
      const initialStats = filterService.getFilterStats();
      
      filterService.addToWhitelist('NewOfficialChannel');
      
      const newStats = filterService.getFilterStats();
      expect(newStats.whitelistSize).toBe(initialStats.whitelistSize + 1);
    });

    it('should support adding to blacklist', () => {
      const initialStats = filterService.getFilterStats();
      
      filterService.addToBlacklist('SpamChannel');
      
      const newStats = filterService.getFilterStats();
      expect(newStats.blacklistSize).toBe(initialStats.blacklistSize + 1);
    });

    it('should not add duplicates to lists', () => {
      const initialStats = filterService.getFilterStats();
      
      filterService.addToWhitelist('TestChannel');
      filterService.addToWhitelist('TestChannel'); // Duplicate
      
      const newStats = filterService.getFilterStats();
      expect(newStats.whitelistSize).toBe(initialStats.whitelistSize + 1);
    });
  });

  describe('edge cases', () => {
    it('should handle videos with missing metadata', () => {
      const incompleteVideo = createMockVideo({
        title: '',
        channelName: '',
        duration: ''
      });

      expect(() => {
        filterService.isAdOrPromo(incompleteVideo);
        filterService.calculateRelevanceScore(incompleteVideo, 'test');
        filterService.isAppropriateLength(incompleteVideo.duration);
      }).not.toThrow();
    });

    it('should handle special characters in search queries', () => {
      const video = createMockVideo({
        title: 'Song with "quotes" & symbols!'
      });

      const score = filterService.calculateRelevanceScore(video, 'song quotes symbols');
      expect(score).toBeGreaterThan(0);
    });

    it('should handle very long titles and channel names', () => {
      const video = createMockVideo({
        title: 'A'.repeat(200),
        channelName: 'B'.repeat(100)
      });

      expect(() => {
        filterService.calculateRelevanceScore(video, 'test query');
        filterService.isAdOrPromo(video);
      }).not.toThrow();
    });
  });
});