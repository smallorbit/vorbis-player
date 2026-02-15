# Mobile Library Drawer — Implementation Plan

## Overview

Add a full-screen drawer that slides down from the top of the screen when the user swipes down on album art (mobile only). The drawer shows the full playlist/album selection UI while playback continues underneath. The user can dismiss the drawer by swiping it up or tapping the handle area.

## Requirements

- **Trigger**: Swipe down on album art (mobile only)
- **Drawer**: Full-screen, slides down from the top
- **Content**: Full PlaylistSelection UI (search, sort, filter, tabs for playlists/albums)
- **Playback**: Continues while drawer is open
- **Dismiss**: Swipe up on drawer handle, or tap handle/backdrop
- **Selection behavior**: Close drawer first (300ms animation), then load new playlist
- **Back to Library button**: In mobile bottom menu, now opens this drawer instead of stopping playback

## Files

### New Files (1)

#### `src/components/LibraryDrawer.tsx`

Full-screen portal-based drawer component.

```typescript
import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import PlaylistSelection from './PlaylistSelection';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
}
```

**Structure:**
- `DrawerOverlay` — Fixed backdrop with opacity transition, click to dismiss
- `DrawerContainer` — Fixed full-screen panel, transforms via `translateY` (slides down from top when open, off-screen when closed). Supports drag offset during swipe-up gesture.
- `DismissHandle` — Sticky header at top of drawer with a pill indicator. Ref target for `useVerticalSwipeGesture`. Click also dismisses.
- `PlaylistSelection` — Rendered inside drawer as-is, only mounts when `isOpen={true}`

**Drawer animation:**
- Open: `translateY(0)`
- Closed: `translateY(-100%)` (slides up off screen)
- Dragging: `translateY(dragOffset)` where dragOffset is negative (pulling up)
- Transition: `300ms cubic-bezier(0.4, 0, 0.2, 1)` when not dragging, `none` during drag

**Playlist selection wrapper:**
```typescript
const handlePlaylistSelectWrapper = useCallback(
  (playlistId: string, playlistName: string) => {
    onClose();
    // Wait for close animation before loading
    setTimeout(() => onPlaylistSelect(playlistId, playlistName), 320);
  },
  [onClose, onPlaylistSelect]
);
```

**Swipe-up dismissal:**
- Use `useVerticalSwipeGesture` on the `DismissHandle` element
- `onSwipeDown` (drag in downward direction from handle) is not used — handle is at top, we only care about upward swipe
- Consider: swipe up anywhere on the drawer (not just handle) to dismiss — this requires attaching gesture to the container, but be careful about scroll conflicts

**Portal rendering:**
```typescript
return createPortal(
  <>
    <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
    <DrawerContainer $isOpen={isOpen} $dragOffset={effectiveDragOffset}>
      <DismissHandle ref={handleRef} onClick={onClose}>
        <HandlePill />
      </DismissHandle>
      {isOpen && <PlaylistSelection onPlaylistSelect={handlePlaylistSelectWrapper} />}
    </DrawerContainer>
  </>,
  document.body
);
```

### Modified Files (3)

#### `src/hooks/usePlayerLogic.ts`

**Add state:**
```typescript
// After line ~68 (playback state)
const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);
```

**Add handlers:**
```typescript
const handleOpenLibraryDrawer = useCallback(() => {
  setShowLibraryDrawer(true);
  setShowPlaylist(false);      // Close playlist drawer if open
  setShowVisualEffects(false); // Close VFX menu if open
}, [setShowPlaylist, setShowVisualEffects]);

const handleCloseLibraryDrawer = useCallback(() => {
  setShowLibraryDrawer(false);
}, []);
```

**Modify `handleBackToLibrary` (lines 299-306):**
```typescript
// BEFORE: stops playback and clears all state
const handleBackToLibrary = useCallback(() => {
  handlePause();
  setSelectedPlaylistId(null);
  setTracks([]);
  setCurrentTrackIndex(0);
  setShowPlaylist(false);
  setShowVisualEffects(false);
}, [handlePause, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowPlaylist, setShowVisualEffects]);

// AFTER: opens library drawer without stopping playback
const handleBackToLibrary = useCallback(() => {
  handleOpenLibraryDrawer();
}, [handleOpenLibraryDrawer]);
```

**Add to return object:**
```typescript
// state:
showLibraryDrawer,

// handlers:
handleOpenLibraryDrawer,
handleCloseLibraryDrawer,
```

#### `src/components/PlayerContent.tsx`

**Add imports:**
```typescript
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import LibraryDrawer from './LibraryDrawer';
```

**Extend props interface:**
```typescript
// In PlayerContentHandlers, add:
onOpenLibraryDrawer?: () => void;
onCloseLibraryDrawer?: () => void;
onPlaylistSelect?: (playlistId: string, playlistName: string) => void;

// In PlayerContentProps ui, add:
showLibraryDrawer: boolean;
```

**Add vertical gesture (after line 244):**
```typescript
const { ref: albumArtRef } = useVerticalSwipeGesture({
  onSwipeDown: handlers.onOpenLibraryDrawer,
  threshold: 80,
  enabled: isMobile,
});
```

**Attach ref to album art container:**

The key challenge is that `ClickableAlbumArtContainer` already uses spread props for horizontal gesture handlers. The vertical gesture uses a `ref`. These need to coexist on the same element.

```tsx
<ClickableAlbumArtContainer
  ref={!isDesktop ? albumArtRef : undefined}
  $swipeEnabled={!isDesktop}
  {...(!isDesktop ? gestureHandlers : {})}
  onClick={!isSwiping && !isAnimating ? toggleControls : undefined}
  style={{...}}
>
```

**Note on gesture coexistence:** The horizontal `useSwipeGesture` uses React synthetic events (`onTouchStart`, `onTouchMove`, `onTouchEnd`) passed via spread. The vertical `useVerticalSwipeGesture` attaches native event listeners via `ref` using `addEventListener`. Both have independent direction locking with a 10px threshold:
- If the first 10px of movement is more horizontal → horizontal hook locks in, vertical hook ignores
- If the first 10px of movement is more vertical → vertical hook locks in, horizontal hook ignores

**Render LibraryDrawer (after line 451, before closing `</ContentWrapper>`):**
```tsx
{isMobile && (
  <LibraryDrawer
    isOpen={ui.showLibraryDrawer}
    onClose={handlers.onCloseLibraryDrawer || (() => {})}
    onPlaylistSelect={handlers.onPlaylistSelect || (() => {})}
  />
)}
```

#### `src/components/AudioPlayer.tsx`

**Pass new props to PlayerContent:**

```typescript
// In the ui object (around line 49), add:
showLibraryDrawer: state.showLibraryDrawer,

// In the handlers object (around line 85), add:
onOpenLibraryDrawer: handlers.handleOpenLibraryDrawer,
onCloseLibraryDrawer: handlers.handleCloseLibraryDrawer,
onPlaylistSelect: handlers.handlePlaylistSelect,
```

### Unchanged Files

- `src/components/PlaylistSelection.tsx` — Reused as-is inside the drawer. Fetches its own data on mount.
- `src/components/MobileBottomMenu/index.tsx` — Already calls `onBackToLibrary` prop, which we redirect in the hook.
- `src/hooks/useSwipeGesture.ts` — Already ignores vertical gestures.
- `src/hooks/useVerticalSwipeGesture.ts` — Reused as-is.

## Gesture Conflict Prevention

Both gesture hooks use a 10px direction-lock threshold:

1. **`useSwipeGesture` (horizontal)**: On touch move, if `absDY > absDX` within the first 10px, sets `directionLocked = 'vertical'` and stops processing the gesture entirely.

2. **`useVerticalSwipeGesture` (vertical)**: On touch move, if `absDX > absDY` within the first 10px, sets `directionLocked = 'horizontal'` and stops processing.

3. **Event propagation**: Horizontal uses React synthetic events (props), vertical uses native `addEventListener` on the ref element. Both see the same touch events but independently decide whether to act.

4. **`touch-action: pan-y`** on `ClickableAlbumArtContainer`: This tells the browser "I'm handling horizontal, you handle vertical scroll." This should be changed to `touch-action: none` since we now handle both axes, OR we let the browser's native vertical scroll be prevented by the vertical gesture hook's `e.preventDefault()`.

**Decision**: Change `touch-action` to `none` on mobile when both gestures are active. The vertical hook already calls `e.preventDefault()` on vertical touch moves to prevent scroll interference.

## PlaylistSelection Context in Drawer

When `PlaylistSelection` is rendered inside the drawer, its `Container` styled component has `min-height: 100dvh`. Inside the drawer, this is fine because the drawer itself is `position: fixed` with full viewport coverage and `overflow-y: auto`. The PlaylistSelection will scroll within the drawer container.

One potential issue: PlaylistSelection's `Container` centers content with `display: flex; align-items: center; justify-content: center`. For the drawer context, the content should be top-aligned instead. Options:
1. Add a prop to PlaylistSelection to control alignment (increases coupling)
2. Override styles from the drawer via a wrapper div
3. Accept the centered layout (it looks fine in a full-screen context)

**Recommendation**: Go with option 3 initially. If centering looks awkward in the drawer, add a wrapper with `align-items: flex-start` override.

## Build Sequence

### Step 1: State Management (`usePlayerLogic.ts`)
1. Add `showLibraryDrawer` state
2. Add `handleOpenLibraryDrawer` handler
3. Add `handleCloseLibraryDrawer` handler
4. Modify `handleBackToLibrary` to open drawer instead of stopping playback
5. Add new state/handlers to return object

### Step 2: Create LibraryDrawer Component
1. Create `LibraryDrawer.tsx` with styled components
2. Implement portal rendering
3. Add swipe-up dismiss via `useVerticalSwipeGesture`
4. Wire up `PlaylistSelection` with close-then-load wrapper
5. Add slide-down/up animation

### Step 3: Integration
1. Update `PlayerContent.tsx` props interface
2. Add `useVerticalSwipeGesture` for album art swipe-down
3. Attach ref to `ClickableAlbumArtContainer`
4. Update `touch-action` for combined gesture handling
5. Render `LibraryDrawer` (mobile only)
6. Update `AudioPlayer.tsx` to pass new props

### Step 4: Testing
1. Verify swipe-down on album art opens drawer (mobile only)
2. Verify horizontal swipes still navigate tracks
3. Verify "Back to Library" button opens drawer without stopping playback
4. Verify drawer dismissal via swipe-up and tap
5. Verify playlist selection closes drawer then loads playlist
6. Verify playback continues while drawer is open
7. Verify desktop is unaffected
8. Verify Escape key closes drawer (may need to add to `useKeyboardShortcuts`)

## Edge Cases

- **Escape key**: Should close the library drawer. Add to the `handleEscapeClose` handler in PlayerContent.
- **Drawer + other overlays**: Opening library drawer auto-closes playlist drawer and VFX menu (handled in `handleOpenLibraryDrawer`).
- **Data freshness**: PlaylistSelection fetches fresh data every time it mounts. Since we conditionally render `{isOpen && <PlaylistSelection />}`, each open gets fresh data.
- **Rapid open/close**: The 320ms delay in playlist selection could cause issues if user opens drawer, selects quickly, then opens again. Use `clearTimeout` pattern or ignore if drawer is already closed.
- **Scroll position reset**: Since PlaylistSelection unmounts on close, scroll position resets each time. This is acceptable since the drawer is a fresh browsing session.
