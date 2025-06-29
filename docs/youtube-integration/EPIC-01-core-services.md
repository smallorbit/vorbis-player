# EPIC 01: Core Services Development

## Overview
This epic focuses on building the foundational services for YouTube search integration. These services can be developed in parallel by multiple agents since they have minimal dependencies on each other.

## Concurrent Agent Assignment

### **Agent 1A: YouTube Search Service**
**Responsible for HTTP scraping and search result parsing**

### **Agent 1B: Video Quality Detection Service**
**Responsible for resolution testing and quality scoring**

### **Agent 1C: Content Filtering Service**
**Responsible for ad/promo filtering and relevance scoring**

---

## Agent 1A Tasks: YouTube Search Service

### Task 1A1: HTTP Scraping Service for YouTube Search
**File**: `src/services/youtubeSearch.ts`

**Deliverables**:
```typescript
interface YouTubeSearchService {
  searchVideos(query: string): Promise<VideoSearchResult[]>;
  extractVideoIds(html: string): string[];
  parseVideoMetadata(html: string, videoId: string): VideoMetadata;
}

interface VideoSearchResult {
  id: string;
  title: string;
  channelName: string;
  duration: string;
  viewCount?: number;
  uploadDate?: string;
  thumbnailUrl: string;
}
```

**Implementation Requirements**:
- Use fetch() to scrape YouTube search results
- Handle CORS issues with appropriate request headers
- Implement retry logic for failed requests
- Add user-agent rotation to avoid detection

**Code Structure**:
```typescript
class YouTubeSearchService {
  private readonly SEARCH_BASE_URL = 'https://www.youtube.com/results';
  private readonly REQUEST_DELAY = 1000; // Rate limiting
  
  async searchVideos(query: string): Promise<VideoSearchResult[]> {
    // Implementation
  }
  
  private async fetchSearchPage(query: string): Promise<string> {
    // HTTP request implementation
  }
  
  private extractVideoIds(html: string): string[] {
    // Regex extraction implementation
  }
  
  private parseVideoMetadata(html: string): VideoSearchResult[] {
    // Metadata parsing implementation
  }
}
```

### Task 1A2: Video ID Extraction with Regex Patterns
**Implementation Focus**:

**Primary Patterns**:
```typescript
const VIDEO_ID_PATTERNS = [
  /"videoId":"([a-zA-Z0-9_-]{11})"/g,
  /\/watch\?v=([a-zA-Z0-9_-]{11})/g,
  /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/g
];
```

**Metadata Extraction Patterns**:
```typescript
const METADATA_PATTERNS = {
  title: /"title":\{"runs":\[\{"text":"([^"]+)"/g,
  channelName: /"ownerText":\{"runs":\[\{"text":"([^"]+)"/g,
  duration: /"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/g,
  viewCount: /"viewCountText":\{"simpleText":"([^"]+)"/g,
  uploadDate: /"publishedTimeText":\{"simpleText":"([^"]+)"/g
};
```

### Task 1A3: Search Result Parsing and Metadata Extraction
**Focus Areas**:
- Extract video titles, channel names, durations
- Parse view counts and upload dates
- Handle different YouTube page layouts
- Robust error handling for missing data

### Task 1A4: Rate Limiting and Caching Implementation
**Requirements**:
```typescript
interface CachingService {
  getCachedResults(query: string): Promise<VideoSearchResult[] | null>;
  setCachedResults(query: string, results: VideoSearchResult[]): Promise<void>;
  clearExpiredCache(): Promise<void>;
}
```

**Implementation Strategy**:
- 5-minute cache for search results
- Maximum 1 request per second rate limiting
- Exponential backoff for failed requests
- Cache invalidation strategy

---

## Agent 1B Tasks: Video Quality Detection Service

### Task 1B1: Thumbnail Resolution Testing Service
**File**: `src/services/videoQuality.ts`

**Deliverables**:
```typescript
interface VideoQualityService {
  detectMaxResolution(videoId: string): Promise<ResolutionLevel>;
  calculateQualityScore(video: VideoSearchResult): Promise<number>;
  testThumbnailAvailability(videoId: string, resolution: string): Promise<boolean>;
}

enum ResolutionLevel {
  VERY_LOW = 'default',      // 120x90
  LOW = 'mqdefault',         // 320x180  
  MEDIUM = 'hqdefault',      // 480x360
  HIGH = 'maxresdefault'     // 1280x720+
}
```

### Task 1B2: Quality Scoring Algorithm Implementation
**Scoring Criteria**:
```typescript
interface QualityScoreFactors {
  resolution: number;        // 0-50 points
  channelQuality: number;    // 0-20 points  
  titleIndicators: number;   // 0-20 points
  ageAndViews: number;       // 0-10 points
}
```

**Implementation**:
```typescript
async calculateQualityScore(video: VideoSearchResult): Promise<number> {
  let score = 0;
  
  // Resolution scoring (most important)
  const resolution = await this.detectMaxResolution(video.id);
  score += this.getResolutionScore(resolution);
  
  // Channel quality indicators
  score += this.getChannelQualityScore(video.channelName);
  
  // Title quality indicators  
  score += this.getTitleQualityScore(video.title);
  
  // View count and age factors
  score += this.getPopularityScore(video);
  
  return Math.min(score, 100);
}
```

### Task 1B3: Channel/Title Quality Indicators
**Channel Quality Patterns**:
```typescript
const HIGH_QUALITY_CHANNEL_PATTERNS = [
  /vevo$/i,                    // Official music videos
  /official/i,                 // Official channels
  /records/i,                  // Record labels
  /(universal|sony|warner)/i,  // Major labels
  /\s+topic$/i                 // YouTube-generated topic channels
];

const QUALITY_TITLE_PATTERNS = [
  /\b(official|video|hd|4k|remastered)\b/i,
  /\b(1080p|720p|60fps)\b/i,
  /\b(lyrics|official\s+audio)\b/i
];
```

### Task 1B4: Resolution Prioritization Logic
**Implementation Strategy**:
- Test thumbnails in priority order: maxres → hq → mq → default
- Use Promise.race() with timeout for fast detection
- Cache resolution results to avoid repeated testing
- Fallback gracefully when higher resolutions unavailable

---

## Agent 1C Tasks: Content Filtering Service

### Task 1C1: Ad/Promo Detection Patterns
**File**: `src/services/contentFilter.ts`

**Deliverables**:
```typescript
interface ContentFilterService {
  filterSearchResults(results: VideoSearchResult[], query: string): VideoSearchResult[];
  isAdOrPromo(video: VideoSearchResult): boolean;
  calculateRelevanceScore(video: VideoSearchResult, query: string): number;
  isAppropriateLength(duration: string): boolean;
}
```

**Ad/Promo Detection**:
```typescript
const AD_PROMO_INDICATORS = {
  titles: [
    /\b(ad|advertisement|sponsored|promo|commercial)\b/i,
    /\b(buy now|click here|limited time|discount)\b/i,
    /\b(sale|offer|deal|free trial)\b/i
  ],
  channels: [
    /ads?$/i,
    /marketing/i,
    /promo/i,
    /commercial/i
  ],
  descriptions: [
    /sponsored content/i,
    /paid promotion/i,
    /affiliate link/i
  ]
};
```

### Task 1C2: Duration-Based Filtering
**Duration Parsing**:
```typescript
function parseDuration(durationString: string): number {
  // Parse formats like "3:45", "1:23:45", "45 seconds"
  const patterns = [
    /(\d+):(\d+):(\d+)/,  // H:M:S
    /(\d+):(\d+)/,        // M:S
    /(\d+)\s*seconds?/    // seconds only
  ];
  
  // Return duration in seconds
}

function isAppropriateLength(duration: string): boolean {
  const seconds = this.parseDuration(duration);
  return seconds >= 30 && seconds <= 900; // 30 seconds to 15 minutes
}
```

### Task 1C3: Relevance Scoring for Search Results
**Relevance Algorithm**:
```typescript
function calculateRelevanceScore(video: VideoSearchResult, query: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const titleWords = video.title.toLowerCase().split(/\s+/);
  const channelWords = video.channelName.toLowerCase().split(/\s+/);
  
  let score = 0;
  
  // Exact phrase matches (highest score)
  if (titleWords.join(' ').includes(query.toLowerCase())) {
    score += 40;
  }
  
  // Individual word matches
  queryWords.forEach(word => {
    if (titleWords.includes(word)) score += 10;
    if (channelWords.includes(word)) score += 5;
  });
  
  // Bonus for official indicators
  if (/official/i.test(video.title)) score += 15;
  if (/vevo/i.test(video.channelName)) score += 20;
  
  return Math.min(score, 100);
}
```

### Task 1C4: Blacklist/Whitelist Channel Management
**Channel Management**:
```typescript
interface ChannelFilters {
  whitelist: string[];  // Always prefer these channels
  blacklist: string[];  // Never show these channels
  patterns: {
    preferred: RegExp[];
    blocked: RegExp[];
  };
}

const CHANNEL_FILTERS: ChannelFilters = {
  whitelist: [
    'officialmusicvevo',
    'universalmusicgroup',
    'sonymusicvevo'
  ],
  blacklist: [
    'ads',
    'marketing',
    'sponsored'
  ],
  patterns: {
    preferred: [
      /vevo$/i,
      /official$/i,
      /records$/i
    ],
    blocked: [
      /fake/i,
      /cover/i,
      /remix/i  // Optional: exclude remixes
    ]
  }
};
```

## Integration Points

### Service Interfaces
All services must implement consistent interfaces for integration:

```typescript
// Common response type
interface FilteredVideoResult extends VideoSearchResult {
  qualityScore: number;
  relevanceScore: number;
  resolutionLevel: ResolutionLevel;
  isFiltered: boolean;
  filterReason?: string;
}

// Main orchestration service
interface VideoSearchOrchestrator {
  findBestVideo(query: string): Promise<FilteredVideoResult | null>;
  findTopVideos(query: string, limit: number): Promise<FilteredVideoResult[]>;
}
```

## Testing Requirements

Each agent must provide:
1. **Unit tests** for their service methods
2. **Mock data** for testing other components  
3. **Integration test scenarios** for their service
4. **Performance benchmarks** for their operations

## Success Criteria

### Agent 1A Success Metrics:
- Successfully scrape YouTube search results for 95% of queries
- Extract video metadata for 90% of found videos
- Maintain <2 second average response time
- Handle rate limiting without errors

### Agent 1B Success Metrics:
- Accurately detect video resolution for 90% of videos
- Quality scoring algorithm provides meaningful differentiation
- Resolution testing completes within 500ms per video
- Cache hit rate >70% for repeated quality checks

### Agent 1C Success Metrics:
- Filter out 95% of obvious ads/promotional content
- Relevance scoring correlates with user expectations
- Duration filtering eliminates inappropriate content
- Channel filtering improves overall result quality

## Dependencies

- **No external dependencies** between Agent 1A, 1B, and 1C tasks
- All agents can work in parallel
- Integration testing requires completion of all Agent 1 tasks
- Epic 2 (Service Integration) depends on completion of Epic 1