# Task 2: Enhance TypeScript Interfaces

## Objective
Create comprehensive TypeScript interfaces for complex props and improve type safety throughout the component hierarchy, with special focus on reducing type inconsistencies and improving developer experience.

## Current Issues
- Missing interfaces for complex component props
- Inconsistent typing between components (e.g., filter types)
- Loose typing leading to potential runtime errors
- Poor IntelliSense support for complex props
- Type inconsistency example: AlbumArtFilters vs VisualEffectsMenu filter interfaces

## Current Type Inconsistencies
```typescript
// AlbumArtFilters expects boolean for invert
interface AlbumArtFilters {
  invert?: boolean;  // ❌ Boolean type
}

// VisualEffectsMenu uses number for invert
const filters = {
  invert: 0  // ❌ Number type
};
```

## Files to Modify
- **Create**: `src/types/player.ts`
- **Create**: `src/types/spotify.ts`
- **Create**: `src/types/visualEffects.ts`
- **Create**: `src/types/components.ts`
- **Modify**: All components to use new interfaces
- **Modify**: Existing type definitions for consistency

## Implementation Steps

### Step 1: Create Core Player Types
Create `src/types/player.ts`:

```typescript
// Base player state types
export interface TrackInfo {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  uri: string;
  duration_ms: number;
  preview_url?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description?: string;
  image?: string;
  tracks: TrackInfo[];
  total: number;
  owner: {
    id: string;
    display_name: string;
  };
}

export interface PlayerState {
  currentTrack: TrackInfo | null;
  tracks: TrackInfo[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  volume: number;
  isMuted: boolean;
  duration: number;
  position: number;
  repeat: 'off' | 'track' | 'context';
  shuffle: boolean;
}

export interface PlaylistState {
  selectedId: string | null;
  playlists: PlaylistInfo[];
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
}

// Player actions interface
export interface PlayerActions {
  // Playback control
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  setRepeat: (mode: 'off' | 'track' | 'context') => void;

  // Track management
  playTrack: (index: number) => void;
  addToQueue: (track: TrackInfo) => void;
  removeFromQueue: (index: number) => void;

  // Playlist management
  selectPlaylist: (playlistId: string) => void;
  refreshPlaylists: () => void;

  // UI control
  showPlaylist: () => void;
  hidePlaylist: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}
```

### Step 2: Create Spotify API Types
Create `src/types/spotify.ts`:

```typescript
// Spotify Web API response types
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
    external_urls: { spotify: string };
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      height: number;
      width: number;
      url: string;
    }>;
    release_date: string;
  };
  duration_ms: number;
  external_urls: { spotify: string };
  preview_url: string | null;
  uri: string;
  track_number: number;
  explicit: boolean;
  popularity: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: Array<{
    height: number | null;
    width: number | null;
    url: string;
  }>;
  owner: {
    id: string;
    display_name: string;
    external_urls: { spotify: string };
  };
  tracks: {
    total: number;
    href: string;
  };
  external_urls: { spotify: string };
  collaborative: boolean;
  public: boolean | null;
  snapshot_id: string;
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  added_by: {
    id: string;
    external_urls: { spotify: string };
  };
  is_local: boolean;
  track: SpotifyTrack;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{
    height: number | null;
    width: number | null;
    url: string;
  }>;
  followers: {
    total: number;
  };
  country: string;
  product: 'free' | 'premium';
}

export interface SpotifyPlaybackState {
  device: {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
  };
  repeat_state: 'off' | 'track' | 'context';
  shuffle_state: boolean;
  context: {
    type: 'album' | 'artist' | 'playlist';
    href: string;
    external_urls: { spotify: string };
    uri: string;
  } | null;
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: SpotifyTrack | null;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
}

// Spotify API error responses
export interface SpotifyError {
  error: {
    status: number;
    message: string;
  };
}

// Authentication types
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyAuthState {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string[];
  user: SpotifyUser | null;
}
```

### Step 3: Create Visual Effects Types (Fix Inconsistencies)
Create `src/types/visualEffects.ts`:

```typescript
// Standardized visual effects types (fixes invert type inconsistency)
export interface VisualEffectFilter {
  brightness: number;    // 0-200, default 100
  contrast: number;      // 0-200, default 100
  saturation: number;    // 0-200, default 100
  hue: number;          // 0-360, default 0
  blur: number;         // 0-20, default 0
  sepia: number;        // 0-100, default 0
  grayscale: number;    // 0-100, default 0
  invert: number;       // 0-100, default 0 (FIXED: now consistent)
}

export interface GlowEffect {
  intensity: number;     // 0-100, default 50
  rate: number;         // 0-10, default 2
  enabled: boolean;
  color?: string;       // Optional override color
}

export interface VisualEffectsState {
  enabled: boolean;
  menuVisible: boolean;
  filters: VisualEffectFilter;
  glow: GlowEffect;
  presets: VisualEffectPreset[];
  activePresetId: string | null;
}

export interface VisualEffectPreset {
  id: string;
  name: string;
  description?: string;
  filters: VisualEffectFilter;
  glow: Omit<GlowEffect, 'enabled'>;
  isCustom: boolean;
  createdAt: number;
}

// Visual effects actions
export interface VisualEffectsActions {
  toggleEnabled: () => void;
  showMenu: () => void;
  hideMenu: () => void;

  // Filter management
  updateFilter: (filter: keyof VisualEffectFilter, value: number) => void;
  resetFilters: () => void;
  applyFilters: (filters: Partial<VisualEffectFilter>) => void;

  // Glow management
  updateGlow: (updates: Partial<GlowEffect>) => void;
  resetGlow: () => void;

  // Preset management
  applyPreset: (presetId: string) => void;
  savePreset: (name: string, description?: string) => string;
  deletePreset: (presetId: string) => void;
  updatePreset: (presetId: string, updates: Partial<VisualEffectPreset>) => void;
}

// Filter validation
export const FILTER_RANGES: Record<keyof VisualEffectFilter, { min: number; max: number; default: number }> = {
  brightness: { min: 0, max: 200, default: 100 },
  contrast: { min: 0, max: 200, default: 100 },
  saturation: { min: 0, max: 200, default: 100 },
  hue: { min: 0, max: 360, default: 0 },
  blur: { min: 0, max: 20, default: 0 },
  sepia: { min: 0, max: 100, default: 0 },
  grayscale: { min: 0, max: 100, default: 0 },
  invert: { min: 0, max: 100, default: 0 }
};

export const DEFAULT_FILTERS: VisualEffectFilter = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  invert: 0
};

export const DEFAULT_GLOW: GlowEffect = {
  intensity: 50,
  rate: 2,
  enabled: false
};
```

### Step 4: Create Component Props Types
Create `src/types/components.ts`:

```typescript
import { TrackInfo, PlayerActions } from './player';
import { VisualEffectFilter, GlowEffect } from './visualEffects';

// Base component props
export interface BaseComponentProps {
  className?: string;
  testId?: string;
}

// Album art component props
export interface AlbumArtProps extends BaseComponentProps {
  currentTrack: TrackInfo | null;
  accentColor: string;
  glowIntensity: number;
  glowRate: number;
  albumFilters: VisualEffectFilter;  // FIXED: now uses consistent type
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

// Player controls props
export interface PlayerControlsProps extends BaseComponentProps {
  currentTrack: TrackInfo | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  canPrevious: boolean;
  canNext: boolean;
  actions: Pick<PlayerActions, 'play' | 'pause' | 'next' | 'previous' | 'setVolume' | 'toggleMute'>;
  accentColor: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

// Visual effects menu props
export interface VisualEffectsMenuProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  filters: VisualEffectFilter;
  glow: GlowEffect;
  onFilterChange: (filter: keyof VisualEffectFilter, value: number) => void;
  onGlowChange: (updates: Partial<GlowEffect>) => void;
  onResetFilters: () => void;
  onResetGlow: () => void;
  presets?: VisualEffectPreset[];
  onPresetApply?: (presetId: string) => void;
  onPresetSave?: (name: string) => void;
}

// Playlist drawer props
export interface PlaylistDrawerProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackInfo[];
  currentTrackIndex: number;
  accentColor: string;
  onTrackSelect: (index: number) => void;
  showCurrentIndicator?: boolean;
  allowReorder?: boolean;
  onTrackReorder?: (fromIndex: number, toIndex: number) => void;
}

// Settings modal props
export interface SettingsModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (updates: Partial<UserSettings>) => void;
}

// User settings type
export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  autoPlay: boolean;
  crossfade: number;  // 0-12 seconds
  volume: number;     // 0-100
  visualEffectsEnabled: boolean;
  notifications: {
    trackChanges: boolean;
    errors: boolean;
    updates: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
  };
  advanced: {
    debugMode: boolean;
    performanceMode: boolean;
    experimentalFeatures: boolean;
  };
}

// Modal props base interface
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

// Button props with variants
export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Icon button props
export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: React.ReactNode;
  label: string;  // For accessibility
  tooltipText?: string;
}
```

### Step 5: Create Type Guards and Validators
Create type validation utilities:

```typescript
// In types/guards.ts
export const isSpotifyTrack = (obj: any): obj is SpotifyTrack => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.artists) &&
    obj.album &&
    typeof obj.duration_ms === 'number' &&
    typeof obj.uri === 'string';
};

export const isValidFilter = (filter: string): filter is keyof VisualEffectFilter => {
  return filter in FILTER_RANGES;
};

export const isValidFilterValue = (filter: keyof VisualEffectFilter, value: number): boolean => {
  const range = FILTER_RANGES[filter];
  return value >= range.min && value <= range.max;
};

export const validateFilters = (filters: Partial<VisualEffectFilter>): VisualEffectFilter => {
  const validatedFilters = { ...DEFAULT_FILTERS };

  for (const [key, value] of Object.entries(filters)) {
    if (isValidFilter(key) && typeof value === 'number' && isValidFilterValue(key, value)) {
      validatedFilters[key] = value;
    }
  }

  return validatedFilters;
};

export const isSpotifyError = (obj: any): obj is SpotifyError => {
  return obj &&
    obj.error &&
    typeof obj.error.status === 'number' &&
    typeof obj.error.message === 'string';
};
```

### Step 6: Update Components to Use New Interfaces
Update existing components to use the new interfaces:

```typescript
// AlbumArt.tsx - FIXED type inconsistency
import { AlbumArtProps } from '../types/components';
import { VisualEffectFilter } from '../types/visualEffects';

const AlbumArt: React.FC<AlbumArtProps> = ({
  currentTrack,
  accentColor,
  glowIntensity,
  glowRate,
  albumFilters,  // Now properly typed as VisualEffectFilter
  size = 'md',
  loading = false,
  className,
  testId
}) => {
  // Component implementation with proper typing
};

// VisualEffectsMenu.tsx - FIXED to use consistent filter type
import { VisualEffectsMenuProps } from '../types/components';
import { VisualEffectFilter } from '../types/visualEffects';

const VisualEffectsMenu: React.FC<VisualEffectsMenuProps> = ({
  filters,  // Now properly typed as VisualEffectFilter
  onFilterChange,
  // ... other props
}) => {
  // Now invert is correctly typed as number (0-100)
  const handleInvertChange = (value: number) => {
    onFilterChange('invert', value);  // Type-safe
  };
};
```

## Testing Requirements

### Type Tests
- [ ] All interfaces compile correctly with TypeScript strict mode
- [ ] Type guards correctly identify object types
- [ ] Validators correctly validate input data
- [ ] IntelliSense provides correct suggestions
- [ ] Type inconsistencies are resolved

### Unit Tests
- [ ] Type guards return correct boolean values
- [ ] Validators handle edge cases correctly
- [ ] Default values are correctly typed
- [ ] Interface implementations work correctly

### Integration Tests
- [ ] Components work correctly with new interface types
- [ ] Props are correctly passed between components
- [ ] Type safety doesn't impact runtime performance
- [ ] Error handling works with typed errors

### Manual Testing
- [ ] All components render correctly with new types
- [ ] Type checking catches errors during development
- [ ] IntelliSense improves developer experience
- [ ] No runtime type errors occur

## Dependencies
- None (can be done independently, but benefits from other cleanup tasks)

## Success Criteria
- [ ] Comprehensive TypeScript interfaces created for all major types
- [ ] Type inconsistencies resolved (e.g., invert filter type)
- [ ] Type guards and validators implemented
- [ ] All components use proper interface types
- [ ] IntelliSense and type checking improved significantly

## Implementation Benefits

### Before (Type Inconsistency)
```typescript
// AlbumArtFilters interface
interface AlbumArtFilters {
  invert?: boolean;  // ❌ Boolean
}

// VisualEffectsMenu usage
const filters = {
  invert: 0  // ❌ Number (type mismatch)
};
```

### After (Type Consistency)
```typescript
// Unified VisualEffectFilter interface
interface VisualEffectFilter {
  invert: number;  // ✅ Consistent number type (0-100)
}

// Type-safe usage everywhere
const filters: VisualEffectFilter = {
  invert: 50  // ✅ Type-safe
};
```

## Advanced Features (Optional)
- **Runtime Type Validation**: Add runtime validation for API responses
- **Type Documentation**: Auto-generate type documentation
- **Type Testing**: Comprehensive type-level testing with TypeScript
- **Generic Utilities**: Create generic utility types for common patterns
- **API Schema Validation**: Validate Spotify API responses against types

## Notes
- Ensure backward compatibility during interface migration
- Test type changes with TypeScript strict mode enabled
- Consider using branded types for additional type safety
- Document breaking changes in type interfaces
- Add JSDoc comments for complex interfaces