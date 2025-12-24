# Album Selection Feature - Implementation Plan

## Feature Overview

Add the ability for users to select and play albums from their Spotify library in addition to playlists. When an album is selected, the player will populate the playlist with only the songs from that album in their original track order.

## Current State Analysis

### What Works Today
- Users can select from their playlists and "Liked Songs"
- Playlists load all tracks and start playback
- Liked Songs are auto-shuffled
- Clean grid UI for playlist selection
- Robust Spotify API integration with PKCE OAuth

### Current Limitations
- **No album entity**: Albums only exist as properties of tracks (name and image)
- **No album API calls**: Missing `getUserAlbums()` and `getAlbumTracks()` functions
- **No album UI**: `PlaylistSelection` component only displays playlists
- **Limited album metadata**: Tracks don't store album ID/URI or track numbers

## Implementation Plan

### Phase 1: Data Models & Types

#### 1.1 Add Album Interface
**File**: `/home/user/vorbis-player/src/services/spotify.ts`

```typescript
export interface AlbumInfo {
  id: string;
  name: string;
  artists: string;  // Comma-separated artist names
  images: { url: string; height: number | null; width: number | null }[];
  release_date: string;
  total_tracks: number;
  uri: string;
  album_type?: string;  // 'album' | 'single' | 'compilation'
}
```

#### 1.2 Extend Track Interface
**File**: `/home/user/vorbis-player/src/services/spotify.ts`

Add optional fields to support album playback with correct ordering:
```typescript
export interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  album_id?: string;        // NEW: Album ID for grouping
  track_number?: number;    // NEW: Position in album
  duration_ms: number;
  uri: string;
  preview_url?: string;
  image?: string;
}
```

### Phase 2: Spotify API Integration

#### 2.1 Add Required OAuth Scope
**File**: `/home/user/vorbis-player/src/services/spotify.ts`

The scope `user-library-read` is already included, so no changes needed.

#### 2.2 Implement getUserAlbums()
**File**: `/home/user/vorbis-player/src/services/spotify.ts`

```typescript
export const getUserAlbums = async (): Promise<AlbumInfo[]> => {
  const token = await spotifyAuth.ensureValidToken();
  const albums: AlbumInfo[] = [];
  let nextUrl = 'https://api.spotify.com/v1/me/albums?limit=50';

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch albums: ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const album = item.album;
      albums.push({
        id: album.id,
        name: album.name,
        artists: album.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        images: album.images || [],
        release_date: album.release_date,
        total_tracks: album.total_tracks,
        uri: album.uri,
        album_type: album.album_type
      });
    }

    nextUrl = data.next;
  }

  return albums;
};
```

**Location**: Insert after `getUserPlaylists()` function (~line 502)

#### 2.3 Implement getAlbumTracks()
**File**: `/home/user/vorbis-player/src/services/spotify.ts`

```typescript
export const getAlbumTracks = async (albumId: string): Promise<Track[]> => {
  const token = await spotifyAuth.ensureValidToken();

  // Get album details including tracks
  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch album: ${response.statusText}`);
  }

  const album = await response.json();
  const tracks: Track[] = [];

  // Map album tracks to Track interface
  for (const track of album.tracks.items || []) {
    if (track.id && track.type === 'track') {
      tracks.push({
        id: track.id,
        name: track.name,
        artists: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        album: album.name,
        album_id: album.id,
        track_number: track.track_number,
        duration_ms: track.duration_ms,
        uri: track.uri,
        preview_url: track.preview_url,
        image: album.images?.[0]?.url
      });
    }
  }

  // Tracks from API are already in album order, but sort to be safe
  return tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
};
```

**Location**: Insert after `getPlaylistTracks()` function (~line 545)

### Phase 3: UI/UX Design

#### 3.1 Selection Mode Architecture

**Approach**: Add a tab/toggle system to switch between "Playlists" and "Albums" views.

**Rationale**:
- Keeps UI clean and focused
- Familiar pattern (similar to Spotify's own UI)
- Prevents overwhelming users with too many options at once
- Easy to implement with existing grid layout

**Alternative Considered**: Combined view showing both playlists and albums in one list
- **Rejected**: Would be cluttered, harder to scan, less organized

#### 3.2 Component Changes

**File**: `/home/user/vorbis-player/src/components/PlaylistSelection.tsx`

##### Changes needed:

1. **Add view mode state**:
```typescript
type ViewMode = 'playlists' | 'albums';
const [viewMode, setViewMode] = useState<ViewMode>('playlists');
const [albums, setAlbums] = useState<AlbumInfo[]>([]);
```

2. **Add tab switcher UI** (before the grid):
```typescript
<div className="tabs">
  <button
    className={viewMode === 'playlists' ? 'active' : ''}
    onClick={() => setViewMode('playlists')}
  >
    Playlists
  </button>
  <button
    className={viewMode === 'albums' ? 'active' : ''}
    onClick={() => setViewMode('albums')}
  >
    Albums
  </button>
</div>
```

3. **Fetch albums on mount**:
```typescript
useEffect(() => {
  const fetchData = async () => {
    // ... existing playlist fetch code ...

    // Fetch albums in parallel
    const userAlbums = await getUserAlbums();
    setAlbums(userAlbums);
  };

  fetchData();
}, []);
```

4. **Conditional rendering** of playlists or albums based on `viewMode`

5. **Add album click handler**:
```typescript
const handleAlbumClick = (album: AlbumInfo) => {
  onPlaylistSelect(`album:${album.id}`, album.name);
};
```

**Note**: We use `album:` prefix to differentiate album IDs from playlist IDs downstream.

### Phase 4: State Management

#### 4.1 Update Player State
**File**: `/home/user/vorbis-player/src/hooks/usePlayerState.ts`

No changes required. The existing `selectedPlaylistId` state can store both playlist and album IDs (distinguished by `album:` prefix).

#### 4.2 Update Playlist Manager
**File**: `/home/user/vorbis-player/src/hooks/usePlaylistManager.ts`

Modify `handlePlaylistSelect()` to detect and handle album selections:

```typescript
const handlePlaylistSelect = useCallback(async (playlistId: string, playlistName: string) => {
  try {
    setError(null);
    setIsLoading(true);
    setSelectedPlaylistId(playlistId);

    await spotifyPlayer.initialize();
    await waitForSpotifyReady();
    await spotifyPlayer.transferPlaybackToDevice();

    let fetchedTracks: Track[] = [];

    // Check if this is an album selection
    if (playlistId.startsWith('album:')) {
      const albumId = playlistId.replace('album:', '');
      fetchedTracks = await getAlbumTracks(albumId);
      // DO NOT shuffle albums - play in track order

    } else if (playlistId === 'liked-songs') {
      fetchedTracks = await getLikedSongs(200);
      fetchedTracks = shuffleArray(fetchedTracks);

    } else {
      // Regular playlist
      fetchedTracks = await getPlaylistTracks(playlistId);
    }

    if (fetchedTracks.length === 0) {
      setError(`No tracks found in this ${playlistId.startsWith('album:') ? 'album' : 'playlist'}.`);
      return;
    }

    setTracks(fetchedTracks);
    setCurrentTrackIndex(0);

    setTimeout(async () => {
      await playTrack(0);
    }, 1000);

  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
}, [/* dependencies */]);
```

**Key Changes**:
- Detect `album:` prefix in `playlistId`
- Call `getAlbumTracks()` for albums
- **Do NOT shuffle album tracks** (preserve track order)
- Update error messages to reflect album vs playlist

### Phase 5: Styling

#### 5.1 Add Tab Styles
**File**: `/home/user/vorbis-player/src/components/PlaylistSelection.tsx`

Add CSS for tab switcher:
```css
.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 2rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.tabs button {
  flex: 1;
  padding: 1rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tabs button:hover {
  color: rgba(255, 255, 255, 0.9);
}

.tabs button.active {
  color: #1db954;  /* Spotify green */
  border-bottom-color: #1db954;
}
```

#### 5.2 Reuse Existing Grid Styles

The existing playlist grid styles can be reused for albums:
- Same card layout
- Same hover effects
- Same image sizing
- Same responsive breakpoints

### Phase 6: Error Handling & Edge Cases

#### 6.1 Empty States

- **No albums saved**: Show message "No albums in your library. Save some albums on Spotify to see them here."
- **Album has no tracks**: Show error and don't start playback
- **API failure**: Display error message, allow retry

#### 6.2 Loading States

- Show spinner while fetching albums (reuse existing loading component)
- Disable tab switching during initial load
- Show loading state when album is being loaded for playback

#### 6.3 Track Order Preservation

- **CRITICAL**: Never shuffle album tracks
- Sort by `track_number` field to ensure correct order
- Handle missing track numbers gracefully (fallback to API order)

### Phase 7: Testing Considerations

#### Manual Testing Checklist

1. **Album Loading**:
   - [ ] Albums load on component mount
   - [ ] Album artwork displays correctly
   - [ ] Artist names display correctly
   - [ ] Track counts are accurate

2. **Album Playback**:
   - [ ] Clicking album starts playback
   - [ ] Tracks play in correct album order (verify track 1, then track 2, etc.)
   - [ ] Album artwork shows in player
   - [ ] All tracks in album are playable

3. **Tab Switching**:
   - [ ] Can switch between Playlists and Albums views
   - [ ] Active tab is visually indicated
   - [ ] Grid updates correctly when switching

4. **Edge Cases**:
   - [ ] Empty library (no saved albums)
   - [ ] Single-track albums
   - [ ] Albums with 50+ tracks
   - [ ] Albums with missing artwork
   - [ ] Network failures during album fetch

5. **Regression Testing**:
   - [ ] Playlist selection still works
   - [ ] Liked Songs still works
   - [ ] Shuffle works for playlists
   - [ ] Player controls work correctly
   - [ ] Existing keyboard shortcuts work

## Implementation Sequence

### Step 1: Data Layer (Backend)
1. Add `AlbumInfo` interface to `spotify.ts`
2. Extend `Track` interface with `album_id` and `track_number`
3. Implement `getUserAlbums()` function
4. Implement `getAlbumTracks()` function
5. Test API functions in isolation

### Step 2: State Management
1. Update `usePlaylistManager.ts` to handle album selections
2. Add logic to detect `album:` prefix
3. Add conditional logic for album vs playlist loading
4. Ensure tracks are not shuffled for albums

### Step 3: UI Layer
1. Add view mode state to `PlaylistSelection.tsx`
2. Add tab switcher UI
3. Add albums state and fetch logic
4. Add conditional rendering for albums grid
5. Add album click handler
6. Add styling for tabs

### Step 4: Polish & Testing
1. Add empty state messages
2. Add loading states
3. Update error messages
4. Manual testing against checklist
5. Fix any bugs discovered

### Step 5: Documentation
1. Update README if needed
2. Add comments to new code
3. Update CLAUDE.md if there are architectural changes

## Risk Assessment

### Low Risk
- API integration (following existing patterns)
- State management (minimal changes)
- Styling (reusing existing components)

### Medium Risk
- Track ordering (must verify track_number field is reliable)
- Large album libraries (performance with 1000+ albums)

### Mitigation Strategies
- **Track ordering**: Always sort by track_number as fallback
- **Performance**: Implement pagination or lazy loading if >200 albums
- **Testing**: Thoroughly test with various album sizes and types

## Success Criteria

1. ✅ Users can switch between "Playlists" and "Albums" views
2. ✅ Albums from user's library display in grid layout
3. ✅ Clicking an album loads and plays all album tracks
4. ✅ Album tracks play in correct track order (1, 2, 3, ...)
5. ✅ Album artwork displays correctly throughout playback
6. ✅ Existing playlist functionality remains unchanged
7. ✅ No performance degradation
8. ✅ Clean, intuitive UI consistent with existing design

## Future Enhancements (Out of Scope)

- Search/filter albums by artist or name
- Sort albums by recently added, artist, or release date
- View album details (release year, genre, etc.) before playing
- Browse all albums from Spotify (not just saved albums)
- Play individual tracks from album view
- Remember last selected view mode (playlist vs album)

---

## Questions for Approval

1. **UI Approach**: Do you approve of the tab-based approach (Playlists | Albums), or would you prefer a different layout?

2. **Track Order**: Confirm that albums should ALWAYS play in track order (never shuffled)?

3. **Album Types**: Should we include singles and compilations, or only full albums? (API returns all types by default)

4. **View Persistence**: Should the app remember if you were viewing playlists or albums when you return?

5. **Initial View**: Should the app default to "Playlists" view or "Albums" view on first load?

Please review this plan and let me know if you'd like any changes before I proceed with implementation!
