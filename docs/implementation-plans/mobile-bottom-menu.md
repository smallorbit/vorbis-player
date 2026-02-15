# Mobile Bottom Slide-Up Menu Bar

## Context

The current mobile experience uses a `MobileQuickActionsDrawer` that sits **inline** below the player controls inside the card. It expands downward via a chevron toggle with a `max-height` animation. This has two UX problems:

1. **Coupled to controls visibility** — the drawer only renders when `isMobile && controlsVisible`, so users can't access quick actions when controls are hidden (e.g., after tapping album art)
2. **Awkward positioning** — expanding downward from the controls card pushes content down and feels unnatural on mobile, where bottom-sheet patterns are the standard

The goal is to replace this with a **viewport-fixed bottom menu bar** that slides up from the bottom of the screen, is always accessible via a small handle/indicator, and supports both tap and swipe-up gestures.

Desktop mode remains completely unchanged.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/MobileBottomMenu/index.tsx` | Main component: manages expand/collapse state, gesture integration, renders via portal |
| `src/components/MobileBottomMenu/styled.ts` | All styled-components: MenuWrapper, HandleArea, PillIndicator, ContentArea, ButtonRow |
| `src/components/MobileBottomMenu/MenuContent.tsx` | Button grid extracted as a sub-component (same buttons as current drawer) |
| `src/hooks/useSwipeGesture.ts` | Reusable touch swipe/drag gesture detection hook |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PlayerContent.tsx` | Remove `MobileQuickActionsDrawer` import/usage/state; add `MobileBottomMenu` render outside `PlayerContainer`, gated only by `isMobile` |
| `src/styles/theme.ts` | Add `mobileMenu: '1350'` to `zIndex` |
| `src/hooks/useKeyboardShortcuts.ts` | Add optional `onCloseMobileMenu` to Escape handler |

## Files to Delete

| File | Reason |
|------|--------|
| `src/components/MobileQuickActionsDrawer.tsx` | Fully replaced by `MobileBottomMenu` |

---

## Implementation Steps

### Step 1: Theme Update (`src/styles/theme.ts`)

Add a new z-index entry between `overlay` (1300) and `modal` (1400):

```ts
zIndex: {
  ...
  overlay: '1300',
  mobileMenu: '1350',   // <-- NEW
  modal: '1400',
  ...
}
```

This places the bottom menu **above** background overlays but **below** modals (playlist drawer, VFX menu), so the menu handle stays accessible while drawers are open, but doesn't block drawer interactions.

---

### Step 2: Swipe Gesture Hook (`src/hooks/useSwipeGesture.ts`)

A reusable hook for vertical swipe detection via Touch Events.

**Interface:**
```ts
interface UseSwipeGestureOptions {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDrag?: (deltaY: number) => void;
  threshold?: number;          // min px distance to trigger (default: 50)
  velocityThreshold?: number;  // min px/ms velocity to trigger (default: 0.3)
  enabled?: boolean;
}

interface UseSwipeGestureReturn {
  ref: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  dragOffset: number;
}
```

**Logic:**
- `touchstart`: Record `startY` and `startTime`, set `isDragging = true`
- `touchmove`: Calculate `deltaY`, call `onDrag(deltaY)`. Use `{ passive: false }` and `preventDefault()` to prevent page scroll during vertical drag. Ignore if initial direction is more horizontal than vertical (angle check on first significant move).
- `touchend`: Calculate velocity = `|deltaY| / elapsed`. Fire `onSwipeUp` if swiped upward past threshold or velocity threshold. Fire `onSwipeDown` if swiped downward. Reset state.
- Apply `touch-action: none` on the handle element to prevent browser defaults.

---

### Step 3: Styled Components (`src/components/MobileBottomMenu/styled.ts`)

**MenuWrapper** — the outer fixed container:
```
position: fixed
bottom: 0; left: 0; right: 0
z-index: theme.zIndex.mobileMenu (1350)
border-radius: 16px 16px 0 0
background: rgba(30, 30, 30, 0.92)
backdrop-filter: blur(20px)
border-top: 1px solid rgba(255, 255, 255, 0.08)
box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35)
padding-bottom: env(safe-area-inset-bottom, 0px)
transform: translateY(...)  // controlled by props
transition: transform ${duration}ms ${easing}  // GPU-accelerated
will-change: transform (only during drag)
```

When **collapsed**: `transform: translateY(calc(100% - HANDLE_HEIGHT))` — only the handle is visible.
When **expanded**: `transform: translateY(0)` — full menu shown.
During **drag**: `transform` follows finger position (no CSS transition, direct value).

HANDLE_HEIGHT = ~32px.

**HandleArea** — tappable handle zone:
```
width: 100%
height: 32px
display: flex; flex-direction: column; align-items: center; justify-content: center
cursor: pointer
touch-action: none
padding: 8px 0
```

**PillIndicator** — the universal drag indicator:
```
width: 40px; height: 4px
background: rgba(255, 255, 255, 0.3)
border-radius: 2px
```

**ContentArea** — button container (hidden when collapsed via parent transform):
```
display: flex; flex-wrap: wrap
align-items: center; justify-content: center
gap: theme.spacing.sm (8px)
padding: theme.spacing.sm (8px) theme.spacing.md (12px)
```

Reuse existing `ControlButton` from `src/components/controls/styled.ts` for all buttons — same `$isMobile={true}`, `$isTablet={false}` props, same accent color theming.

---

### Step 4: Menu Content (`src/components/MobileBottomMenu/MenuContent.tsx`)

Extracted sub-component containing the button grid. Same buttons as the current `MobileQuickActionsDrawer`:

1. **Glow toggle** — `ControlButton` with `isActive={glowEnabled}`, `GlowIcon`
2. **Background Visualizer toggle** — conditional on `onBackgroundVisualizerToggle` prop, `BackgroundVisualizerIcon`
3. **Playlist** — opens playlist drawer, `PlaylistIcon`
4. **Visual Effects** — opens VFX menu, `VisualEffectsIcon`
5. **Color Picker** — `ColorPickerPopover` (renders via portal, so positioning works from bottom)
6. **Back to Library** — conditional on `onBackToLibrary` prop, `BackToLibraryIcon`
7. **Debug section** — conditional on `debugModeEnabled`

All icons imported from `src/components/icons/QuickActionIcons.tsx`.

Uses `useCustomAccentColors` hook for color picker integration (same as current drawer).

**Auto-collapse behavior:** When the user taps Playlist or Visual Effects (actions that open full-screen drawers), the menu auto-collapses. Glow/Visualizer toggles do NOT auto-collapse (quick toggle).

---

### Step 5: Main Component (`src/components/MobileBottomMenu/index.tsx`)

**State:**
- `isExpanded` (boolean) — internal state, not lifted to parent
- Drag state comes from `useSwipeGesture` hook

**Rendering via `createPortal`:** Render to `document.body` to avoid stacking context issues from `ContentWrapper`'s `container-type: inline-size`.

**Transform calculation:**
```ts
const getTransform = () => {
  if (isDragging) {
    // Follow finger, clamped between fully collapsed and fully expanded
    const contentHeight = contentRef.current?.offsetHeight ?? 80;
    const clampedOffset = Math.max(-contentHeight, Math.min(0, dragOffset));
    return `translateY(calc(100% - ${HANDLE_HEIGHT}px + ${clampedOffset}px))`;
  }
  return isExpanded
    ? 'translateY(0)'
    : `translateY(calc(100% - ${HANDLE_HEIGHT}px))`;
};
```

**Gesture wiring:**
- Swipe up on handle -> expand
- Swipe down on handle -> collapse
- Tap handle -> toggle
- The `ref` from `useSwipeGesture` attaches to the `HandleArea`

**Auto-collapse on drawer open:** Wrap `onShowPlaylist`/`onShowVisualEffects` callbacks to call `collapse()` then the original handler.

**Props interface:** Same as current `MobileQuickActionsDrawerProps` minus `isExpanded` and `onToggleExpand` (state is internal), plus `transitionDuration` and `transitionEasing` from `usePlayerSizing`.

**Accessibility:**
- `role="toolbar"` on wrapper, `aria-label="Quick actions"`
- `aria-expanded={isExpanded}` on handle button
- `aria-label` on handle: "Expand quick actions" / "Collapse quick actions"
- `aria-hidden={!isExpanded}` on content area
- Respect `prefers-reduced-motion`: skip drag-follow animation, use instant toggle

---

### Step 6: Integration (`src/components/PlayerContent.tsx`)

Changes to `PlayerContent.tsx`:

1. **Remove** `import MobileQuickActionsDrawer` (line 8)
2. **Add** `import MobileBottomMenu from './MobileBottomMenu'`
3. **Remove** `mobileDrawerExpanded` state and `toggleMobileDrawer` callback (lines 217, 224-226)
4. **Remove** the `{isMobile && controlsVisible && (<MobileQuickActionsDrawer .../>)}` block (lines 364-382)
5. **Add** `MobileBottomMenu` render **after** `PlayerContainer` closing tag but **inside** `ContentWrapper`, gated only by `{isMobile && (...)}` — no `controlsVisible` dependency:

```tsx
{isMobile && (
  <MobileBottomMenu
    accentColor={ui.accentColor}
    currentTrack={track.current}
    glowEnabled={effects.enabled}
    backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
    onShowPlaylist={handlers.onShowPlaylist}
    onShowVisualEffects={handlers.onShowVisualEffects}
    onGlowToggle={handlers.onGlowToggle}
    onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
    onAccentColorChange={handlers.onAccentColorChange}
    onBackToLibrary={handlers.onBackToLibrary}
    debugModeEnabled={handlers.debugModeEnabled}
    transitionDuration={transitionDuration}
    transitionEasing={transitionEasing}
  />
)}
```

---

### Step 7: Keyboard Shortcut Update (`src/hooks/useKeyboardShortcuts.ts`)

Add optional `onCloseMobileMenu?: () => void` to the handlers interface. Wire into the Escape case so pressing Escape also collapses the bottom menu.

In `PlayerContent.tsx`, pass a ref-based close callback or use an imperative handle (`useImperativeHandle`) to expose `collapse()` from `MobileBottomMenu`. Alternatively, since the menu state is internal, the simplest approach: pass an `externalCloseSignal` prop (a counter or boolean that toggles) to `MobileBottomMenu`, and use a `useEffect` inside the menu to collapse when it changes.

---

### Step 8: Delete Old Drawer

Remove `src/components/MobileQuickActionsDrawer.tsx` entirely.

---

## Edge Cases

- **Safe area insets**: `viewport-fit=cover` is already set in `index.html`. The `MenuWrapper` uses `padding-bottom: env(safe-area-inset-bottom, 0px)` to respect iPhone home indicators.
- **Landscape mode**: Buttons use `flex-wrap: wrap` — on narrow landscape heights, the menu stays compact. The handle remains at 32px.
- **ColorPickerPopover positioning**: The popover uses `createPortal` to `document.body` and positions above the trigger button via `getBoundingClientRect()`. Since the button is near the bottom, the popover's existing upward positioning (`transform: translate(-50%, -100%)`) should work. Verify on small screens.
- **Menu + drawer overlap**: The menu (z-index 1350) sits below drawer overlays (1300) and modals (1400). When playlist/VFX drawers open, the menu auto-collapses. The handle remains tappable above background content.
- **Rapid taps**: CSS `transform` transitions naturally interpolate from current position — no jitter on rapid toggles.

---

## Verification

1. **Build**: Run `tsc -b && vite build` — no type errors
2. **Dev server**: Run `npm run dev`, open on mobile viewport (Chrome DevTools device emulation or real device)
3. **Test collapsed state**: Only the pill handle visible at the bottom of the screen
4. **Test tap to expand**: Tap handle -> menu slides up showing all buttons
5. **Test tap to collapse**: Tap handle again -> menu slides down
6. **Test swipe up**: Swipe up on handle -> expands
7. **Test swipe down**: Swipe down on handle -> collapses
8. **Test buttons**: Each button (glow, visualizer, playlist, VFX, color picker, back to library) functions correctly
9. **Test auto-collapse**: Tapping Playlist or Visual Effects collapses the menu and opens the respective drawer
10. **Test desktop unchanged**: On desktop viewport, side panels appear as before, no bottom menu
11. **Test controls hidden**: Tap album art to hide controls -> bottom menu handle still visible and functional
12. **Test safe area**: On iPhone (or simulator), verify the menu respects the home indicator area
13. **Run tests**: `npm run test:run` — all existing tests pass
14. **Run lint**: `npm run lint` — no lint errors
