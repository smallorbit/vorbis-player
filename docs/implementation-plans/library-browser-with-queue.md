# Implementation Plan: Library Browser Drawer with Queue System

## Goal
Add a left-side library browser drawer that allows browsing playlists/albums while music plays, with a queue system for adding playlists to play next.

## User Requirements
- **Left-side drawer** (mirrors existing right-side playlist drawer)
- **Queue system**: Add playlists to queue instead of immediate playback
- **Queue management**: Reorder (drag & drop), remove items, clear all
- **Queue visible** in library drawer with playlist names and track counts
- **Auto-advance**: When current playlist ends, load first item from queue
- **Keyboard shortcut**: 'B' to toggle library browser
- **Both drawers open**: Library (left) and playlist (right) can be open simultaneously
- **Queue persistence**: Saved in localStorage

## Architecture Overview

### Components to Create
1. **LibraryBrowserDrawer** - Left-side drawer container
2. **QueueManager** - Queue display and management UI
3. **LibraryBrowser** - Extracted reusable library browsing component

### State Changes
Add to `usePlayerState.ts`:
```typescript
interface QueueItem {
  id: string;                    // Playlist ID
  type: 'playlist' | 'album' | 'liked-songs';
  name: string;
  trackCount: number;
  imageUrl?: string;
  addedAt: number;
}

interface QueueState {
  items: QueueItem[];
  isLibraryDrawerVisible: boolean;
}
```

### Queue Flow
```
1. User clicks "Add to Queue" in library drawer
   → addToQueue(item) → localStorage persist

2. Current playlist ends (detected by useAutoAdvance)
   → Check if queue.items.length > 0
   → If yes: load first queue item, remove from queue
   → If no: loop current playlist (existing behavior)
```

## Implementation Phases

### Phase 1: State Foundation
**Files**: `src/hooks/usePlayerState.ts`, `src/types/queue.ts`

- [ ] Create `QueueItem` interface in `src/types/queue.ts`
- [ ] Add `QueueState` to `usePlayerState.ts` (note: `LibraryDrawerState` already exists at line 32!)
- [ ] Add queue actions: `addToQueue`, `removeFromQueue`, `reorderQueue`, `clearQueue`
- [ ] Add localStorage persistence (key: `vorbis-player-queue`)

### Phase 2: API Layer
**Files**: `src/services/spotify.ts`

- [ ] Create `getPlaylistMetadata(playlistId, type)` function
  - Returns lightweight metadata: trackCount, imageUrl
  - Handles playlists, albums, and liked-songs
  - Reuses `getCachedData` pattern for caching

### Phase 3: Queue UI Components
**Files**: `src/components/QueueManager.tsx`

- [ ] Install dependency: `@dnd-kit/core` for drag & drop
- [ ] Create QueueManager component
  - Queue item list with thumbnails, names, track counts
  - Drag handles for reordering
  - Remove buttons (× icon)
  - Clear all button
  - Empty state message

### Phase 4: Library Browser Component
**Files**: `src/components/LibraryBrowser.tsx`, `src/components/LibraryBrowserDrawer.tsx`

- [ ] Extract `LibraryBrowser.tsx` from `PlaylistSelection.tsx`
  - Reusable component with 'select' vs 'browse' mode
  - Keep tabs (playlists/albums), search, sort, filter
  - Keep image lazy loading

- [ ] Create `LibraryBrowserDrawer.tsx`
  - Mirror `PlaylistDrawer.tsx` structure (lines 9-54)
  - Position: `left: 0` (instead of `right: 0`)
  - Transform: `translateX(isOpen ? '0' : '-100%')`
  - Two-section layout: LibraryBrowser (top) + QueueManager (bottom)
  - Add to queue button on each playlist item

### Phase 5: Hook Updates

**File**: `src/hooks/useAutoAdvance.ts` (lines 14-69)
- [ ] Add `queueItems` prop
- [ ] Add `onLoadNextFromQueue` callback
- [ ] Modify lines 45-51: Check queue when playlist ends
  ```typescript
  const nextIndex = (currentTrackIndex + 1) % tracks.length;

  // NEW: Check if we've looped back to start AND queue has items
  if (nextIndex === 0 && queueItems.length > 0) {
    onLoadNextFromQueue(queueItems[0]);
    return;
  }

  // Existing: Normal track advancement
  playTrack(nextIndex, true);
  ```

**File**: `src/hooks/usePlaylistManager.ts`
- [ ] Add `handleAddToQueue` function
  - Fetch metadata via `getPlaylistMetadata()`
  - Create QueueItem object
  - Call `addToQueue()` action
  - Does NOT start playback

**File**: `src/hooks/usePlayerLogic.ts`
- [ ] Destructure queue state from `usePlayerState`
- [ ] Create queue handlers:
  - `handleToggleLibraryBrowser`
  - `handleAddToQueue`
  - `handleRemoveFromQueue`
  - `handleReorderQueue`
  - `handleClearQueue`
  - `handleLoadNextFromQueue` (calls `handlePlaylistSelect`, then `removeFromQueue`)
- [ ] Return queue state and handlers in return statement

**File**: `src/hooks/useKeyboardShortcuts.ts` (line ~215)
- [ ] Add `onToggleLibraryBrowser` to `KeyboardShortcutHandlers` interface
- [ ] Add 'B' key handler:
  ```typescript
  case 'KeyB':
    if (!event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onToggleLibraryBrowser?.();
    }
    break;
  ```

### Phase 6: UI Integration

**File**: `src/components/PlayerContent.tsx` (after line ~230)
- [ ] Import `LibraryBrowserDrawer` (lazy loaded)
- [ ] Add to JSX after PlaylistDrawer:
  ```typescript
  <Suspense fallback={<LibraryDrawerFallback />}>
    <LibraryBrowserDrawer
      isOpen={queue.isLibraryDrawerVisible}
      onClose={handlers.onCloseLibraryDrawer}
      queue={queue.items}
      onAddToQueue={handlers.onAddToQueue}
      onRemoveFromQueue={handlers.onRemoveFromQueue}
      onReorderQueue={handlers.onReorderQueue}
      onClearQueue={handlers.onClearQueue}
    />
  </Suspense>
  ```

**File**: `src/components/AudioPlayer.tsx`
- [ ] Pass queue state/handlers to PlayerContent

### Phase 7: Styling & Polish

**LibraryBrowserDrawer styling**:
- Mirror PlaylistDrawer pattern
- Responsive widths: mobile (100vw), tablet (400px), desktop (500px)
- Two-section layout:
  - LibrarySection: `flex: 1` (scrollable)
  - QueueSection: `max-height: 40vh`, border-top (scrollable)

**Both drawers open**:
- Each drawer has own overlay (z-index: 1300)
- Drawers at z-index: 1400
- Click overlay only closes its own drawer

### Phase 8: Testing

**Manual Testing Checklist**:
- [ ] 'B' shortcut toggles library drawer
- [ ] Library drawer slides from left smoothly
- [ ] Both drawers can be open simultaneously
- [ ] Add to queue doesn't start playback
- [ ] Queue displays with metadata (thumbnails, names, track counts)
- [ ] Drag & drop reordering works
- [ ] Remove individual items works
- [ ] Clear all queue works
- [ ] When playlist ends, next queue item loads automatically
- [ ] Queue item removed from queue after loading
- [ ] Queue persists after page refresh (localStorage)
- [ ] Empty queue shows helpful message
- [ ] Responsive design works (mobile/tablet/desktop)
- [ ] Search/filter works in library drawer
- [ ] No memory leaks (check DevTools)

**Edge Cases to Test**:
- [ ] Empty queue (should loop current playlist)
- [ ] Queue item removed while loading
- [ ] Network errors during metadata fetch
- [ ] Both drawers open + close interactions
- [ ] Large queue (20+ items) performance

## Critical Files

| File | Purpose |
|------|---------|
| `src/hooks/usePlayerState.ts` | Add QueueState, queue actions, localStorage |
| `src/hooks/useAutoAdvance.ts` | Queue advancement logic (lines 45-51) |
| `src/hooks/usePlayerLogic.ts` | Orchestrate queue handlers |
| `src/hooks/useKeyboardShortcuts.ts` | Add 'B' shortcut |
| `src/components/LibraryBrowserDrawer.tsx` | **NEW** - Main library drawer |
| `src/components/QueueManager.tsx` | **NEW** - Queue UI |
| `src/components/LibraryBrowser.tsx` | **NEW** - Extracted from PlaylistSelection |
| `src/services/spotify.ts` | Add getPlaylistMetadata() |
| `src/components/PlayerContent.tsx` | Integrate LibraryBrowserDrawer |
| `src/components/PlaylistDrawer.tsx` | **REFERENCE** - Pattern to mirror |

## Verification Steps

After implementation:

1. **Start application**: `npm run dev`
2. **Select a playlist** and start playback
3. **Press 'B'**: Library drawer should slide in from left
4. **Search/filter** playlists in library
5. **Click "Add to Queue"** on 2-3 playlists
6. **Verify queue** displays at bottom with metadata
7. **Drag to reorder** queue items
8. **Remove item** from queue using × button
9. **Press 'P'**: Playlist drawer should open on right (both drawers open)
10. **Wait for playlist to end** or skip to last track
11. **Verify**: First queue item should load and start playing
12. **Verify**: Queue item removed after loading
13. **Refresh page**: Queue should persist (localStorage)
14. **Clear queue**: All items removed

## Potential Challenges

1. **Both overlays visible**: Solution - each overlay closes only its own drawer
2. **Queue metadata staleness**: Acceptable - track count is approximate
3. **Mobile drag & drop**: @dnd-kit has built-in touch support with long-press
4. **Performance with large queues**: Virtual scrolling if needed (react-window)
5. **localStorage race conditions**: Debounce queue updates (150ms)

## Notes

- LibraryDrawerState already exists in usePlayerState.ts (line 32) - investigate if usable
- Follow existing patterns: PlaylistDrawer for drawer structure, PlaylistSelection for library UI
- Queue limit recommendation: 25-50 items max
- Use same responsive sizing as PlaylistDrawer (container queries + media query fallbacks)
- Keep queue simple initially - can add features like "play next" vs "add to end" later
