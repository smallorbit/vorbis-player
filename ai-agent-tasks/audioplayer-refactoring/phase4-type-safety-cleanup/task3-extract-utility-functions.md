# Task 3: Extract Utility Functions

## Objective
Extract pure functions and complex logic from components into reusable utility modules, improving testability, reusability, and separation of concerns.

## Current Issues
- Complex utility logic embedded in components (accent color handling lines 360-391)
- Repeated logic patterns across components
- Difficult to test complex logic in isolation
- Poor reusability of common operations

## Current Embedded Logic Examples
```typescript
// Complex accent color logic in AudioPlayer (lines 360-391)
const handleAccentColorChange = useCallback((color: string) => {
  if (color === 'RESET_TO_DEFAULT' && currentTrack?.id) {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[currentTrack.id!];
      return newOverrides;
    });
    if (currentTrack?.image) {
      extractDominantColor(currentTrack.image)
        .then(dominantColor => {
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor(theme.colors.accent);
          }
        })
        .catch(() => {
          setAccentColor(theme.colors.accent);
        });
    } else {
      setAccentColor(theme.colors.accent);
    }
    return;
  }
  // ... more logic
}, [currentTrack?.id, currentTrack?.image, setAccentColorOverrides, setAccentColor]);
```

## Files to Create
- **Create**: `src/utils/accentColorUtils.ts`
- **Create**: `src/utils/trackUtils.ts`
- **Create**: `src/utils/playlistUtils.ts`
- **Create**: `src/utils/timeUtils.ts`
- **Create**: `src/utils/storageUtils.ts`
- **Create**: `src/utils/validationUtils.ts`
- **Create**: `src/utils/formatUtils.ts`

## Implementation Steps

### Step 1: Create Accent Color Utilities
Create `src/utils/accentColorUtils.ts`:

```typescript
import { extractDominantColor } from './colorExtractor';
import { theme } from '../styles/theme';

export interface AccentColorOverrides {
  [trackId: string]: string;
}

export interface AccentColorResult {
  color: string;
  source: 'override' | 'extracted' | 'fallback';
  cached: boolean;
}

// Color cache for performance
const colorCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 100;

/**
 * Resolves accent color for a track with override support
 */
export const resolveAccentColor = async (
  trackId: string | undefined,
  imageUrl: string | undefined,
  overrides: AccentColorOverrides
): Promise<AccentColorResult> => {
  // Check for override first
  if (trackId && overrides[trackId]) {
    return {
      color: overrides[trackId],
      source: 'override',
      cached: false
    };
  }

  // Check cache
  if (imageUrl && colorCache.has(imageUrl)) {
    return {
      color: colorCache.get(imageUrl)!,
      source: 'extracted',
      cached: true
    };
  }

  // Extract from image
  if (imageUrl) {
    try {
      const dominantColor = await extractDominantColor(imageUrl);
      if (dominantColor?.hex) {
        // Cache the result
        if (colorCache.size >= CACHE_SIZE_LIMIT) {
          // Remove oldest entry (LRU-like behavior)
          const firstKey = colorCache.keys().next().value;
          colorCache.delete(firstKey);
        }
        colorCache.set(imageUrl, dominantColor.hex);

        return {
          color: dominantColor.hex,
          source: 'extracted',
          cached: false
        };
      }
    } catch (error) {
      console.warn('Failed to extract color from image:', error);
    }
  }

  // Fallback to theme color
  return {
    color: theme.colors.accent,
    source: 'fallback',
    cached: false
  };
};

/**
 * Updates accent color overrides immutably
 */
export const updateAccentColorOverride = (
  overrides: AccentColorOverrides,
  trackId: string,
  color: string | 'RESET_TO_DEFAULT'
): AccentColorOverrides => {
  if (color === 'RESET_TO_DEFAULT') {
    const newOverrides = { ...overrides };
    delete newOverrides[trackId];
    return newOverrides;
  }

  return {
    ...overrides,
    [trackId]: color
  };
};

/**
 * Validates if a color string is valid hex format
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color);
};

/**
 * Converts RGB values to hex color
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (value: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, value))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Converts hex color to RGB values
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  if (!isValidHexColor(hex)) return null;

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Calculates color brightness (0-255)
 */
export const getColorBrightness = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 128; // Fallback to medium brightness

  // Using luminance formula
  return Math.round((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000);
};

/**
 * Determines if a color is dark (useful for text contrast)
 */
export const isColorDark = (hex: string): boolean => {
  return getColorBrightness(hex) < 128;
};

/**
 * Clears the color cache (useful for memory management)
 */
export const clearColorCache = (): void => {
  colorCache.clear();
};

/**
 * Gets current cache size (useful for debugging)
 */
export const getColorCacheSize = (): number => {
  return colorCache.size;
};
```

### Step 2: Create Track Utilities
Create `src/utils/trackUtils.ts`:

```typescript
import { TrackInfo } from '../types/player';
import { SpotifyTrack } from '../types/spotify';

/**
 * Converts Spotify API track to internal TrackInfo format
 */
export const convertSpotifyTrack = (spotifyTrack: SpotifyTrack): TrackInfo => {
  const primaryArtist = spotifyTrack.artists[0];
  const largestImage = spotifyTrack.album.images.reduce((largest, current) => {
    if (!largest || (current.width && current.width > (largest.width || 0))) {
      return current;
    }
    return largest;
  }, spotifyTrack.album.images[0]);

  return {
    id: spotifyTrack.id,
    name: spotifyTrack.name,
    artist: primaryArtist ? primaryArtist.name : 'Unknown Artist',
    album: spotifyTrack.album.name,
    image: largestImage ? largestImage.url : '',
    uri: spotifyTrack.uri,
    duration_ms: spotifyTrack.duration_ms,
    preview_url: spotifyTrack.preview_url
  };
};

/**
 * Formats track duration from milliseconds to display string
 */
export const formatTrackDuration = (duration_ms: number): string => {
  const totalSeconds = Math.floor(duration_ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Formats track position for display
 */
export const formatTrackPosition = (position_ms: number, duration_ms: number): string => {
  const position = formatTrackDuration(position_ms);
  const duration = formatTrackDuration(duration_ms);
  return `${position} / ${duration}`;
};

/**
 * Calculates track progress percentage (0-100)
 */
export const getTrackProgress = (position_ms: number, duration_ms: number): number => {
  if (duration_ms === 0) return 0;
  return Math.min(100, Math.max(0, (position_ms / duration_ms) * 100));
};

/**
 * Gets the next track index with wrap-around
 */
export const getNextTrackIndex = (currentIndex: number, trackCount: number): number => {
  if (trackCount === 0) return 0;
  return (currentIndex + 1) % trackCount;
};

/**
 * Gets the previous track index with wrap-around
 */
export const getPreviousTrackIndex = (currentIndex: number, trackCount: number): number => {
  if (trackCount === 0) return 0;
  return currentIndex === 0 ? trackCount - 1 : currentIndex - 1;
};

/**
 * Shuffles an array of tracks using Fisher-Yates algorithm
 */
export const shuffleTracks = <T>(tracks: T[]): T[] => {
  const shuffled = [...tracks];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Finds track index by ID
 */
export const findTrackIndex = (tracks: TrackInfo[], trackId: string): number => {
  return tracks.findIndex(track => track.id === trackId);
};

/**
 * Checks if a track has a preview URL available
 */
export const hasPreview = (track: TrackInfo): boolean => {
  return Boolean(track.preview_url);
};

/**
 * Gets track artists as comma-separated string
 */
export const getTrackArtists = (spotifyTrack: SpotifyTrack): string => {
  return spotifyTrack.artists.map(artist => artist.name).join(', ');
};

/**
 * Validates track data completeness
 */
export const isValidTrack = (track: TrackInfo): boolean => {
  return Boolean(
    track.id &&
    track.name &&
    track.artist &&
    track.uri &&
    track.duration_ms > 0
  );
};

/**
 * Filters out invalid tracks from an array
 */
export const filterValidTracks = (tracks: TrackInfo[]): TrackInfo[] => {
  return tracks.filter(isValidTrack);
};

/**
 * Creates a track search key for searching/filtering
 */
export const createTrackSearchKey = (track: TrackInfo): string => {
  return `${track.name} ${track.artist} ${track.album}`.toLowerCase();
};

/**
 * Searches tracks by query string
 */
export const searchTracks = (tracks: TrackInfo[], query: string): TrackInfo[] => {
  if (!query.trim()) return tracks;

  const searchQuery = query.toLowerCase();
  return tracks.filter(track =>
    createTrackSearchKey(track).includes(searchQuery)
  );
};
```

### Step 3: Create Playlist Utilities
Create `src/utils/playlistUtils.ts`:

```typescript
import { PlaylistInfo, TrackInfo } from '../types/player';
import { SpotifyPlaylist } from '../types/spotify';

/**
 * Converts Spotify API playlist to internal PlaylistInfo format
 */
export const convertSpotifyPlaylist = (
  spotifyPlaylist: SpotifyPlaylist,
  tracks: TrackInfo[] = []
): PlaylistInfo => {
  const primaryImage = spotifyPlaylist.images[0];

  return {
    id: spotifyPlaylist.id,
    name: spotifyPlaylist.name,
    description: spotifyPlaylist.description || undefined,
    image: primaryImage ? primaryImage.url : undefined,
    tracks,
    total: spotifyPlaylist.tracks.total,
    owner: {
      id: spotifyPlaylist.owner.id,
      display_name: spotifyPlaylist.owner.display_name
    }
  };
};

/**
 * Formats playlist duration from track durations
 */
export const getPlaylistDuration = (tracks: TrackInfo[]): {
  totalMs: number;
  formatted: string;
} => {
  const totalMs = tracks.reduce((sum, track) => sum + track.duration_ms, 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let formatted = '';
  if (hours > 0) {
    formatted = `${hours} hr ${minutes} min`;
  } else {
    formatted = `${minutes} min`;
  }

  return { totalMs, formatted };
};

/**
 * Creates a playlist statistics summary
 */
export const getPlaylistStats = (playlist: PlaylistInfo): {
  trackCount: number;
  duration: { totalMs: number; formatted: string };
  artists: { name: string; count: number }[];
  albums: { name: string; count: number }[];
} => {
  const duration = getPlaylistDuration(playlist.tracks);

  // Count artists
  const artistCounts = playlist.tracks.reduce((acc, track) => {
    acc[track.artist] = (acc[track.artist] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const artists = Object.entries(artistCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Count albums
  const albumCounts = playlist.tracks.reduce((acc, track) => {
    acc[track.album] = (acc[track.album] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const albums = Object.entries(albumCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    trackCount: playlist.tracks.length,
    duration,
    artists,
    albums
  };
};

/**
 * Special playlist ID for Liked Songs
 */
export const LIKED_SONGS_PLAYLIST_ID = 'liked-songs';

/**
 * Checks if playlist is the special Liked Songs playlist
 */
export const isLikedSongsPlaylist = (playlistId: string): boolean => {
  return playlistId === LIKED_SONGS_PLAYLIST_ID;
};

/**
 * Creates a Liked Songs playlist info object
 */
export const createLikedSongsPlaylist = (tracks: TrackInfo[]): PlaylistInfo => {
  return {
    id: LIKED_SONGS_PLAYLIST_ID,
    name: 'Liked Songs',
    description: 'Your saved tracks from Spotify',
    tracks,
    total: tracks.length,
    owner: {
      id: 'spotify',
      display_name: 'Spotify'
    }
  };
};

/**
 * Validates playlist data completeness
 */
export const isValidPlaylist = (playlist: PlaylistInfo): boolean => {
  return Boolean(
    playlist.id &&
    playlist.name &&
    playlist.owner?.id
  );
};

/**
 * Filters out invalid playlists from an array
 */
export const filterValidPlaylists = (playlists: PlaylistInfo[]): PlaylistInfo[] => {
  return playlists.filter(isValidPlaylist);
};

/**
 * Sorts playlists by various criteria
 */
export const sortPlaylists = (
  playlists: PlaylistInfo[],
  sortBy: 'name' | 'trackCount' | 'owner'
): PlaylistInfo[] => {
  return [...playlists].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'trackCount':
        return b.total - a.total;
      case 'owner':
        return a.owner.display_name.localeCompare(b.owner.display_name);
      default:
        return 0;
    }
  });
};

/**
 * Searches playlists by query string
 */
export const searchPlaylists = (playlists: PlaylistInfo[], query: string): PlaylistInfo[] => {
  if (!query.trim()) return playlists;

  const searchQuery = query.toLowerCase();
  return playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery) ||
    playlist.owner.display_name.toLowerCase().includes(searchQuery) ||
    (playlist.description && playlist.description.toLowerCase().includes(searchQuery))
  );
};
```

### Step 4: Create Time and Format Utilities
Create `src/utils/timeUtils.ts`:

```typescript
/**
 * Debounces a function call
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttles a function call
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Creates a delayed promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Formats milliseconds to human-readable time
 */
export const formatMilliseconds = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
};

/**
 * Formats relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Creates a timeout that can be cancelled
 */
export const createCancellableTimeout = (
  callback: () => void,
  delay: number
): { cancel: () => void } => {
  const timeout = setTimeout(callback, delay);

  return {
    cancel: () => clearTimeout(timeout)
  };
};

/**
 * Creates an interval that can be cancelled
 */
export const createCancellableInterval = (
  callback: () => void,
  interval: number
): { cancel: () => void } => {
  const intervalId = setInterval(callback, interval);

  return {
    cancel: () => clearInterval(intervalId)
  };
};

/**
 * Measures execution time of a function
 */
export const measureTime = async <T>(
  name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
};
```

### Step 5: Create Storage Utilities
Create `src/utils/storageUtils.ts`:

```typescript
/**
 * Type-safe localStorage wrapper with error handling
 */
export class TypedStorage {
  private prefix: string;

  constructor(prefix = 'vorbis-player') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}-${key}`;
  }

  /**
   * Stores a value with automatic JSON serialization
   */
  set<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.getKey(key), serialized);
      return true;
    } catch (error) {
      console.error(`Failed to store item "${key}":`, error);
      return false;
    }
  }

  /**
   * Retrieves a value with automatic JSON deserialization
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to retrieve item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Removes an item from storage
   */
  remove(key: string): boolean {
    try {
      localStorage.removeItem(this.getKey(key));
      return true;
    } catch (error) {
      console.error(`Failed to remove item "${key}":`, error);
      return false;
    }
  }

  /**
   * Checks if an item exists in storage
   */
  has(key: string): boolean {
    try {
      return localStorage.getItem(this.getKey(key)) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clears all items with the prefix
   */
  clear(): boolean {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.prefix}-`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Gets all keys with the prefix
   */
  keys(): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.prefix}-`)) {
          keys.push(key.replace(`${this.prefix}-`, ''));
        }
      }
      return keys;
    } catch (error) {
      console.error('Failed to get storage keys:', error);
      return [];
    }
  }
}

// Create default storage instance
export const storage = new TypedStorage();

// Specific storage utilities for common use cases
export const visualEffectsStorage = {
  getFilters: () => storage.get('album-filters'),
  setFilters: (filters: any) => storage.set('album-filters', filters),
  getGlowSettings: () => storage.get('glow-settings'),
  setGlowSettings: (settings: any) => storage.set('glow-settings', settings)
};

export const userPreferencesStorage = {
  getVolume: () => storage.get('volume', 100),
  setVolume: (volume: number) => storage.set('volume', volume),
  getTheme: () => storage.get('theme', 'auto'),
  setTheme: (theme: string) => storage.set('theme', theme)
};
```

### Step 6: Update Components to Use Utilities
Update AudioPlayer.tsx to use the new utilities:

```typescript
// Replace complex accent color handling with utility
import { resolveAccentColor, updateAccentColorOverride } from '../utils/accentColorUtils';
import { getNextTrackIndex, getPreviousTrackIndex } from '../utils/trackUtils';

const AudioPlayerComponent = () => {
  // Replace complex handleAccentColorChange with simple utility call
  const handleAccentColorChange = useCallback(async (color: string) => {
    if (!currentTrack?.id) return;

    const newOverrides = updateAccentColorOverride(
      accentColorOverrides,
      currentTrack.id,
      color
    );
    setAccentColorOverrides(newOverrides);

    if (color === 'RESET_TO_DEFAULT') {
      const result = await resolveAccentColor(
        currentTrack.id,
        currentTrack.image,
        newOverrides
      );
      setAccentColor(result.color);
    } else {
      setAccentColor(color);
    }
  }, [currentTrack, accentColorOverrides, setAccentColorOverrides, setAccentColor]);

  // Replace manual index calculation with utilities
  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = getNextTrackIndex(currentTrackIndex, tracks.length);
    playTrack(nextIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = getPreviousTrackIndex(currentTrackIndex, tracks.length);
    playTrack(prevIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);
};
```

## Testing Requirements

### Unit Tests
- [ ] All utility functions work correctly in isolation
- [ ] Edge cases are handled properly
- [ ] Type safety is maintained
- [ ] Performance utilities work as expected
- [ ] Storage utilities handle errors gracefully

### Integration Tests
- [ ] Components work correctly with extracted utilities
- [ ] Utilities integrate well with existing code
- [ ] No functionality is lost during extraction
- [ ] Performance is maintained or improved

### Performance Tests
- [ ] Utility functions don't introduce performance regressions
- [ ] Caching utilities improve performance
- [ ] Memory usage is reasonable
- [ ] Debounce/throttle utilities work correctly

### Manual Testing
- [ ] All player functionality works identically
- [ ] Utilities provide expected behavior
- [ ] Error handling works correctly
- [ ] Storage persistence works correctly

## Dependencies
- None (can be done independently of other tasks)

## Success Criteria
- [ ] Complex logic extracted from components into reusable utilities
- [ ] Utilities are well-tested and type-safe
- [ ] Code reusability and maintainability improved
- [ ] All existing functionality preserved
- [ ] Performance maintained or improved

## Implementation Benefits

### Before (Embedded Logic)
```typescript
// Complex accent color logic embedded in component (30+ lines)
const handleAccentColorChange = useCallback((color: string) => {
  if (color === 'RESET_TO_DEFAULT' && currentTrack?.id) {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[currentTrack.id!];
      return newOverrides;
    });
    // ... 25 more lines of complex logic
  }
  // ... more logic
}, [/* many dependencies */]);
```

### After (Utility Functions)
```typescript
// Simple utility call
const handleAccentColorChange = useCallback(async (color: string) => {
  if (!currentTrack?.id) return;

  const newOverrides = updateAccentColorOverride(accentColorOverrides, currentTrack.id, color);
  setAccentColorOverrides(newOverrides);

  if (color === 'RESET_TO_DEFAULT') {
    const result = await resolveAccentColor(currentTrack.id, currentTrack.image, newOverrides);
    setAccentColor(result.color);
  } else {
    setAccentColor(color);
  }
}, [currentTrack, accentColorOverrides, setAccentColorOverrides, setAccentColor]);
```

## Advanced Features (Optional)
- **Utility Composition**: Compose utilities for complex operations
- **Performance Monitoring**: Add performance monitoring to utilities
- **Utility Documentation**: Auto-generate utility documentation
- **Utility Testing**: Comprehensive utility testing framework
- **Utility Benchmarking**: Benchmark utility performance

## Notes
- Test utilities thoroughly in isolation before integration
- Consider utility composition patterns for complex operations
- Ensure utilities are framework-agnostic where possible
- Document utility functions with JSDoc comments
- Consider creating utility bundles for related functionality