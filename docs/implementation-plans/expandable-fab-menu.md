# Plan: Expandable FAB Menu Button

## Context

The app currently has a full-width bottom menu bar (MobileBottomMenu on viewports < 700px, DesktopBottomMenu on >= 700px) that displays 6 quick-action buttons. The user wants to replace this with a single floating action button (FAB) in the bottom-right corner that, when tapped, fans out the menu items in an arc pattern. This declutters the UI and provides a more compact, elegant interaction.

## Design

- **Trigger button**: A circular FAB with a "+" icon that rotates 45deg to become "X" when open
- **Position**: Fixed bottom-right corner of the viewport
- **Animation**: Items fan out in an arc into the upper-left quadrant (since button is bottom-right)
- **Collapse**: Menu collapses when an item is selected, when clicking outside, or pressing Escape
- **Replaces**: Both MobileBottomMenu and DesktopBottomMenu
- **Padding**: Remove the bottom menu padding-bottom from ContentWrapper since the FAB doesn't overlap content

## Files to Create

### 1. `src/components/FabMenu/styled.ts`
- `FabOverlay` - Full-screen transparent click-catcher (position: fixed, inset: 0, z-index: mobileMenu)
- `FabContainer` - Anchor for FAB + arc items (position: fixed, bottom-right, z-index: mobileMenu + 1)
- `FabButton` - 56px circle, glassmorphism style matching DesktopBottomMenu, `$isOpen`/`$accentColor` props, rotates SVG child 45deg when open
- `FabMenuItem` - Absolutely positioned at bottom: 0, right: 0; uses `$angle` (radians) and `$radius` (px) props to calculate `translate()` position via trig; scales 0→1 on open; staggered `transition-delay` (40ms per item on open, 20ms reverse on close)
- `FabMenuItemTooltip` - Label to the left of each item, visible on hover/focus (desktop), hidden on mobile

### 2. `src/components/FabMenu/FabMenuItems.tsx`
- Renders the 6 menu items in an arc (same items/order as current `MenuContent.tsx:46-120`)
- Arc config: start ~100deg, end ~210deg, radius ~80px (70px on mobile)
- Builds item list dynamically (conditional items like BackgroundVisualizer and BackToLibrary filtered out when handlers are undefined)
- ColorPickerPopover rendered directly (not wrapped in `onItemAction`) so it manages its own click behavior
- Uses `ControlButton` from `controls/styled.ts` and icons from `icons/QuickActionIcons.tsx`
- Uses `useCustomAccentColors` hook (same pattern as current `MenuContent.tsx:41-44`)
- Uses `usePlayerSizing` for `isMobile` flag to adjust sizing

### 3. `src/components/FabMenu/index.tsx`
- Main component, portaled to `document.body` via `createPortal`
- State: `isOpen` (boolean), `colorPickerActive` (boolean)
- `toggle()` - toggles isOpen
- `collapse()` - closes menu unless `colorPickerActive` is true
- `handleItemAction(action)` - wraps each item's callback to also collapse the menu
- Escape key listener when open (always force-closes)
- Auto-collapse when `colorPickerActive` transitions from true→false
- Renders: `FabOverlay` (when open) + `FabContainer` > `FabMenuItems` + `FabButton`
- Same props interface as current menus (accentColor, currentTrack, glowEnabled, etc.)

## Files to Modify

### 4. `src/components/ColorPickerPopover.tsx` (lines 11-19, 58-66)
- Add optional `onOpenChange?: (isOpen: boolean) => void` prop to interface
- Add `useEffect` that calls `onOpenChange?.(showColorPopover)` when `showColorPopover` changes
- Add `onOpenChange` to the memo comparison function (`areColorPickerPropsEqual`) - skip comparing it (treat as stable callback)
- This allows FabMenu to know when the color picker popover is open/closed

### 5. `src/components/PlayerContent.tsx`
- **Remove imports**: `MobileBottomMenu`, `DesktopBottomMenu`, `MOBILE_BOTTOM_MENU_HEIGHT`, `DESKTOP_BOTTOM_MENU_HEIGHT` (lines 6-9)
- **Add import**: `FabMenu` from `./FabMenu`
- **Simplify ContentWrapper padding-bottom** (lines 102-103): Change from `calc(padding + MENU_HEIGHT + safe-area)` to just `${props.padding}px`
- **Remove `$isMobile` prop** from ContentWrapper styled component (lines 88, 95) since it was only used for the menu height conditional
- **Remove `$isMobile` prop** from ContentWrapper usage (line 312)
- **Replace menu rendering** (lines 384-410): Replace the `isMobile ? <MobileBottomMenu> : <DesktopBottomMenu>` conditional with a single `<FabMenu>` with the same props

## Files to Delete

### 6. Old menu components (after verification)
- `src/components/MobileBottomMenu/index.tsx`
- `src/components/MobileBottomMenu/MenuContent.tsx`
- `src/components/MobileBottomMenu/styled.ts`
- `src/components/DesktopBottomMenu/index.tsx`
- `src/components/DesktopBottomMenu/MenuContent.tsx`
- `src/components/DesktopBottomMenu/styled.ts`

## Key Reuse

- `ControlButton` from `src/components/controls/styled.ts` - same button component used by current menus
- Icons from `src/components/icons/QuickActionIcons.tsx` - GlowIcon, BackgroundVisualizerIcon, VisualEffectsIcon, BackToLibraryIcon, PlaylistIcon, ColorPickerIcon
- `useCustomAccentColors` from `src/hooks/useCustomAccentColors.ts` - per-track color override management
- `usePlayerSizing` from `src/hooks/usePlayerSizing.ts` - mobile/desktop detection for sizing
- `ColorPickerPopover` from `src/components/ColorPickerPopover.tsx` - renders its own button and popover
- `getContrastColor` from `src/utils/colorUtils.ts` - dynamic text contrast on accent backgrounds
- Theme tokens from `src/styles/theme.ts` - zIndex.mobileMenu, colors.overlay.dark, drawer.backdropBlur, colors.popover.border, borderRadius.full, transitions.normal, spacing

## ColorPickerPopover Edge Case

The ColorPickerPopover manages its own internal `showColorPopover` state and renders its own portal popover. When the user clicks the color picker in the arc, the FAB must stay open so the popover has an anchor. Solution:
1. ColorPickerPopover gets a new `onOpenChange` callback prop
2. FabMenu tracks `colorPickerActive` state via this callback
3. `collapse()` is blocked while `colorPickerActive` is true
4. When color picker closes (`colorPickerActive` goes false), FabMenu auto-collapses

## Accessibility

- FAB button: `aria-label`, `aria-expanded`, `aria-haspopup="true"`
- Menu items: `aria-label` on each ControlButton
- Toggle items (glow, visualizer): `aria-pressed` for active state
- `@media (prefers-reduced-motion: reduce)`: disable arc animation
- Escape key closes the menu
- Tab navigation works naturally through focusable buttons

## Verification

1. Run `tsc -b && vite build` to confirm no type errors or build failures
2. Run `npm run test:run` to confirm no test regressions
3. Verify visually that:
   - FAB appears in bottom-right corner on both mobile and desktop viewports
   - Clicking FAB fans items out in an arc with staggered animation
   - Clicking an item triggers the action and collapses the menu
   - Color picker keeps FAB open while its popover is active
   - Clicking outside or pressing Escape collapses the menu
   - Content is no longer padded for a bottom bar
