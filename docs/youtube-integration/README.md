# YouTube Search-Based Video Integration

## Project Overview

This project transforms the Vorbis Player from using static retro TV video collections to dynamically searching YouTube for videos related to the currently playing song. The integration uses HTTP scraping (no API key required) to find relevant music videos with intelligent filtering for quality and relevance.

## Architecture

### Current State
- **MediaCollage Component**: Displays curated videos from static JSON files (`80sTV-videoIds.json`, `90sTV-videoIds.json`)
- **YouTube Service**: Basic video ID extraction and embed URL creation
- **Track Data**: Spotify integration provides `name` and `artists` properties

### Target State
- **Dynamic Search**: Real-time YouTube search based on current track
- **Quality Filtering**: Prioritize HD videos and filter out ads/promos
- **Smart Caching**: Cache search results to improve performance
- **Relevance Scoring**: Intelligent matching of videos to tracks

## Key Features

### 1. YouTube Search Service
- HTTP-based search result scraping
- Video metadata extraction (title, duration, channel, thumbnails)
- Rate limiting and error handling
- Search result caching

### 2. Content Filtering System
- **Ad/Promo Detection**: Filter out advertisements and promotional content
- **Duration Filtering**: Exclude very short (ads) or very long (irrelevant) videos
- **Channel Quality**: Prioritize official channels and verified artists
- **Title Relevance**: Score videos based on search query match

### 3. Video Quality Detection
- **Resolution Testing**: Test thumbnail URLs to determine max available resolution
- **Quality Scoring**: Rank videos by resolution and quality indicators
- **HD Preference**: Prioritize 720p+ content when available
- **Smart Fallbacks**: Gracefully handle lower quality when HD unavailable

### 4. Enhanced User Experience
- **Now Playing Integration**: Videos directly related to current track
- **Preserved Functionality**: Keep video lock and shuffle features
- **Loading States**: Clear feedback during search and loading
- **Error Handling**: Graceful fallbacks when search fails

## Implementation Strategy

### Phase 1: Core Services (Parallelizable)
- YouTube search scraping service
- Video quality detection service  
- Content filtering and scoring service

### Phase 2: Service Integration
- Enhanced YouTube service with search capabilities
- Caching and performance optimization
- Error handling and fallback strategies

### Phase 3: UI Updates
- MediaCollage component refactoring
- Remove static video mode system
- Add search-based loading states

### Phase 4: System Integration
- AudioPlayer integration
- End-to-end testing
- Performance optimization

## Technical Specifications

### Search Query Construction
```typescript
const searchQuery = `${track.name} ${track.artists}`;
// Example: "Bohemian Rhapsody Queen"
```

### Quality Detection Strategy
```typescript
// Test thumbnail resolution availability
const resolutions = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
// maxresdefault = 1280x720+ (HD)
// hqdefault = 480x360 (SD)
// mqdefault = 320x180 (Low)
// default = 120x90 (Very Low)
```

### Content Filtering Criteria
- **Duration**: 30 seconds to 15 minutes
- **Exclude Terms**: "ad", "advertisement", "sponsored", "promo"
- **Prefer Terms**: "official", "vevo", "remastered", "hd", "4k"
- **Channel Quality**: Verified artists, record labels, music channels

## File Structure

```
src/
├── services/
│   ├── youtubeSearch.ts          # New: YouTube search scraping
│   ├── videoQuality.ts           # New: Quality detection service
│   ├── contentFilter.ts          # New: Content filtering service
│   └── youtube.ts                # Modified: Enhanced with search
├── components/
│   ├── MediaCollage.tsx          # Modified: Dynamic search integration
│   └── AudioPlayer.tsx           # Modified: Re-enable MediaCollage
└── types/
    └── youtube.ts                # New: Type definitions
```

## Success Metrics

- **Relevance**: 90%+ of videos directly related to playing track
- **Quality**: 70%+ of videos in HD resolution when available
- **Performance**: Search results cached, <2s average load time
- **Reliability**: Graceful fallbacks, 99%+ uptime for video display
- **User Experience**: Seamless integration with existing player controls

## Risk Mitigation

- **Rate Limiting**: Implement delays and caching to avoid YouTube blocking
- **Search Failures**: Multiple fallback strategies for failed searches
- **Content Quality**: Multi-layered filtering to ensure relevant, high-quality videos
- **Performance**: Aggressive caching and async loading for smooth UX

## Dependencies

- Existing Spotify integration for track metadata
- React components and state management
- TypeScript for type safety
- Existing YouTube service architecture

## Getting Started

See individual epic documentation files for detailed implementation plans:
- [EPIC-01: Core Services](./EPIC-01-core-services.md)
- [EPIC-02: UI Components](./EPIC-02-ui-components.md) 
- [EPIC-03: Integration](./EPIC-03-integration.md)
- [EPIC-04: Testing & QA](./EPIC-04-testing-qa.md)

For parallel execution strategy, see: [CONCURRENT-EXECUTION.md](./CONCURRENT-EXECUTION.md)
For task dependencies, see: [TASK-DEPENDENCIES.md](./TASK-DEPENDENCIES.md)