# UX Brief — #1335: Desktop Right-Click Context Menu on Library Cards

**Status:** Ready for architect  
**Date:** 2026-04-26  
**Token dependency:** `theme.colors.menu.destructiveText` (`#f87171`) — shipped in a1fc30b ✅

---

## What is already implemented

The core plumbing is already wired on the epic branch. The following exist and should **not** be re-created:

| Piece | Location | State |
|---|---|---|
| `onContextMenu` handler on `CardButton` | `LibraryCard.tsx` lines 74–82 | ✅ done |
| `LibraryContextMenu` (Radix Popover, virtual anchor) | `contextMenu/LibraryContextMenu.tsx` | ✅ done |
| `handleContextMenuRequest` / `contextRequest` state | `LibraryRoute/index.tsx` | ✅ done |
| `onContextMenuRequest` prop threaded through all sections | `HomeView`, `SeeAllView`, `SearchResultsView`, all section components | ✅ done |
| `menu.destructiveText` token defined | `src/styles/theme.ts` | ✅ done |

**What this issue must add** is the four gaps below.

---

## Target user flow

### Entry — right-click (desktop pointer)

1. User has the Library open on desktop (viewport ≥ 700px, pointer device).
2. User right-clicks any library card (playlist, album, liked songs, recently-played).
3. The native browser context menu is suppressed (`preventDefault`). ← already done
4. The card enters the **open** state (see §Active card state below).
5. `LibraryContextMenu` opens anchored to the cursor position (virtual anchor already implemented).
6. Focus moves to the **first enabled menu item** in the popover.

### Entry — keyboard context menu key

1. User tabs to a library card (focus ring visible on `CardButton`).
2. User presses the **Context Menu key** (Windows keyboard) or **Shift+F10**.
3. Same result as step 3–6 above, except the anchor uses the card's bounding rect bottom-left instead of the cursor position. (The existing `onContextMenu` DOM event already fires for keyboard context menu key — no separate handler needed.)

### Navigating the menu

7. **Arrow Down / Arrow Up** cycles focus through enabled menu items; wraps from last to first and first to last.
8. **Home** moves focus to the first enabled item. **End** moves to the last enabled item.
9. **Enter** or **Space** activates the focused item (closes menu, executes action).
10. **Escape** closes the menu. Focus returns to the card that triggered it (§Focus return).
11. **Tab** / **Shift+Tab** closes the menu and resumes normal tab flow (standard Popover dismiss behavior).
12. Click outside the popover closes the menu; no focus return is required (pointer interaction).

### Exit

- On dismiss via Escape or menu item activation: focus returns to the triggering `CardButton`.
- On dismiss via click-outside or Tab: focus follows the normal browser flow (no forced return).
- On dismiss: the card exits the **open** state.

---

## Components touched

- **The library card** (`card/LibraryCard.tsx` + `card/LibraryCard.styled.ts`) — add open state prop, focus-return ref.
- **The context menu** (`contextMenu/LibraryContextMenu.tsx`) — pass first-item focus ref, emit focus-return signal on close.
- **The context menu styled layer** (`contextMenu/LibraryContextMenu.styled.ts`) — correct destructive color token (gap #1); add `focus-visible` outline (gap #3).
- **The library route root** (`LibraryRoute/index.tsx`) — track the triggering element ref for focus return (gap #2).

No other surfaces are affected.

---

## Gap 1 — Destructive item color token mismatch

### Problem
`LibraryContextMenu.styled.ts` currently resolves destructive item text to `theme.colors.error` = `#ef4444`.

**Verified contrast of `#ef4444` on popover background `#232323`: 4.18:1** — fails WCAG AA 4.5:1 for normal text.

### Fix
Replace with `theme.colors.menu.destructiveText` = `#f87171`.

**Verified contrast of `#f87171` on `#232323`: 5.68:1** ✅ passes WCAG AA.

### Testable assertion
> The "Remove from history" menu item (the only current `variant="destructive"` item) achieves a contrast ratio ≥ 4.5:1 against the popover background `#232323`.

---

## Gap 2 — Focus return on Escape / item activation

### Problem
`handleCloseContextMenu` in `LibraryRoute/index.tsx` simply calls `setContextRequest(null)`. Focus is lost (moves to `<body>`) on Escape or after activating an item.

### Desired behavior
- When `LibraryContextMenu` opens, the triggering `CardButton`'s DOM node is captured in a ref at the `LibraryRoute` level.
- When `onClose` is called via Escape or item activation (but not click-outside), the captured ref is `.focus()`-ed.

### Signal to distinguish dismiss reasons
Radix `Popover` fires `onOpenChange(false)` for Escape, click-outside, and after `focusOutside`. To distinguish "intentional keyboard dismiss" from "click-outside dismiss":
- Escape: `onEscapeKeyDown` prop on `PopoverContent` → set a `shouldReturnFocus` flag before calling `onClose`.
- Item activation: the `closeAfter` wrapper already invokes `onClose` — that path should always return focus.
- Click-outside / Tab: do not return focus.

The architect will determine the cleanest implementation pattern.

### Testable assertion
> After pressing Escape to dismiss the context menu, the browser's focused element is the `CardButton` that originally triggered the menu.

---

## Gap 3 — Arrow key navigation within the menu

### Problem
`MenuItemButton` elements have `role="menuitem"` but no arrow-key handler exists. The Radix `Popover` primitive does **not** manage focus within its content. Users relying on keyboard must Tab through each item sequentially, which is non-standard for a `role="menu"` widget.

### Required behavior (ARIA menu keyboard pattern)
| Key | Action |
|-----|--------|
| `ArrowDown` | Focus next enabled item (wraps to first) |
| `ArrowUp` | Focus previous enabled item (wraps to last) |
| `Home` | Focus first enabled item |
| `End` | Focus last enabled item |
| `Enter` / `Space` | Activate focused item |
| `Escape` | Close menu, return focus to trigger |
| `Tab` / `Shift+Tab` | Close menu, resume natural tab flow |

Disabled items are skipped during arrow-key cycling.

On open, focus lands on the **first enabled item**.

### Implementation note for architect
A `keydown` handler on the `MenuRoot` (`role="menu"`) div intercepts the above keys. The handler walks `querySelectorAll('[role="menuitem"]:not(:disabled)')` to determine focus targets. Alternatively, consider migrating the popup to Radix `DropdownMenu` which manages this natively — leave that call to the architect.

### Testable assertions
> 1. When the context menu is open and focused on the first item, pressing `ArrowDown` moves focus to the second item.  
> 2. Pressing `ArrowDown` on the last item wraps focus to the first enabled item.  
> 3. Pressing `ArrowUp` on the first item wraps focus to the last enabled item.

---

## Gap 4 — Active (open) state on the triggering card

### Problem
While the context menu is open, the triggering card has no visual indication that it is the source of the popup. A sighted user who opens the menu via keyboard has no clear "this card is selected" marker.

### Desired behavior
When `contextRequest` is non-null and the triggering card's `id` matches, the `CardButton` receives a `data-context-menu-open="true"` attribute (or a boolean prop).

### Visual treatment
Reuse the existing `focus-visible` outline ring — `outline: 2px solid ${theme.colors.primary}` (`#646cff`) with `outline-offset: 2px` and `border-radius: ${theme.borderRadius.lg}`.

**Verified contrast of `#646cff` vs card background (dark library surface ≈ `#1a1a1a`): 4.14:1** — meets WCAG AA for UI components (3:1 threshold).

The treatment is visually identical to the keyboard focus ring, which is intentional: the card is "keyboard-active" while its menu is open.

### Testable assertion
> A `CardButton` with `data-context-menu-open="true"` has a visible ring matching the focus-visible ring; the ring is removed when the menu closes.

---

## Gap 3a — Menu item focus ring

### Problem
`MenuItemButton` currently sets `outline: none` on `focus-visible` and relies solely on a `background: rgba(255, 255, 255, 0.08)` tint.

**Verified contrast of that tint (#353535) vs non-hover bg (#232323): 1.28:1** — does not meet WCAG 2.1's minimum "some visible indicator" intent, and clearly fails WCAG 2.2 Focus Appearance (3:1).

### Fix
Replace `outline: none` with:
```
outline: 2px solid rgba(255, 255, 255, 0.6);
outline-offset: -2px;
border-radius: ${theme.borderRadius.md};
```

**Verified contrast of rgba(255,255,255,0.6) composited outline (~#BDBDBD) vs hover bg (#353535): 6.53:1** ✅  
**Verified contrast of the same outline vs non-hover bg (#232323): 8.37:1** ✅

The background tint is retained as a secondary indicator; the outline is added on top of it.

### Testable assertion
> A focused (keyboard) `MenuItemButton` has a visible outline with contrast ≥ 3:1 against the popover background (#232323).

---

## Menu items by card kind

*No changes to existing menu item sets — documented here for reference.*

| Card kind | Menu items (in order) |
|---|---|
| **Playlist** | Play · Add to Queue · Play Next¹ · Pin / Unpin · Start Radio¹ · Queue Liked Songs² |
| **Album** | Play · Add to Queue · Play Next¹ · Pin / Unpin · Save / Unsave³ · Start Radio¹ · Queue Liked Songs² |
| **Liked Songs** | Play All · Play (Spotify)⁴ · Play (Dropbox)⁴ |
| **Recently Played** | Same as underlying kind, plus **Remove from history** (destructive, always last) |

¹ Disabled (opacity 40%) when the relevant prop is absent.  
² Present only when `onQueueLikedTracks` is provided and the collection has a provider.  
³ Present only for Spotify albums with save-status data available.  
⁴ One item per connected provider.

**"Remove from history"** is the only destructive item. It must use `theme.colors.menu.destructiveText` = `#f87171` (Gap #1).

---

## Positioning logic

*Already implemented — no changes needed.*

- Anchor: a zero-size fixed `div` at `{ left: e.clientX, top: e.clientY }` (cursor position for mouse) or card `getBoundingClientRect()` bottom-left (keyboard).
- Popover: `align="start"` `side="bottom"` `sideOffset={4}`. Radix auto-flips when near viewport edge.
- z-index: `POPOVER_Z_INDEX = 1500` (already set in `popover.tsx`).

---

## Design tokens introduced

None. All required tokens are already in the system.

| Token | Value | Contrast | Use |
|---|---|---|---|
| `theme.colors.menu.destructiveText` | `#f87171` | 5.68:1 vs `#232323` ✅ | Destructive item text |
| `theme.colors.primary` | `#646cff` | ≥ 3:1 vs dark card bg ✅ | Open-state card ring |

---

## Accessibility constraints (testable)

1. **Destructive text contrast ≥ 4.5:1**: `#f87171` on `#232323` = 5.68:1. ✅
2. **Regular text contrast ≥ 4.5:1**: `rgba(255,255,255,0.87)` ≈ `#dedede` on `#232323` = 11.68:1. ✅
3. **Menu item focus indicator contrast ≥ 3:1**: `rgba(255,255,255,0.6)` outline on `#232323` = 8.37:1. ✅
4. **Focus returns to trigger card** after Escape or item activation.
5. **Arrow keys navigate menu items** per ARIA Menu pattern.
6. **First enabled item receives focus** when menu opens.
7. **`aria-label` on MenuRoot**: already `aria-label={`Actions for ${request.name}`}`. ✅
8. **`role="menu"` / `role="menuitem"`**: already applied. ✅
9. **Escape closes menu**: Radix Popover handles this. ✅
10. **`prefers-reduced-motion`**: The Popover already uses Radix default animation. If the architect adds a custom enter animation, `motion-reduce:` Tailwind variant must be applied. Flag if relevant.
11. **Card open-state ring**: `#646cff` outline ≥ 3:1 vs adjacent dark background. ✅

---

## Mockup — low-fi

```
Library grid (desktop) — one card right-clicked
┌────────────────────────────────────────────────────┐
│  [🎵]  [🎵]  [🎵]  [🎵 ←──────────────────────┐  │
│  Name  Name  Name  Name │  Play                  │  │
│                         │  Add to Queue          │  │
│  [🎵]  [🎵]  [🎵]  [🎵]│  Play Next             │  │
│  Name  Name  Name  Nam  │  Pin                   │  │
│                    ┌────│  Start Radio           │  │
│  [🎵] ═══════════╗│╔═══│  ─────────────────────ˇ  │
│       active ring ║│║   │  Remove from history   │  │
│                   ╚╝╚═══│  (red #f87171)         │  │
│                         └────────────────────────┘  │
└────────────────────────────────────────────────────┘

  Focus ring on triggering card:
    outline: 2px solid #646cff; outline-offset: 2px

  Menu item focused state:
    background: rgba(255,255,255,0.08)
    outline: 2px solid rgba(255,255,255,0.6); outline-offset: -2px

  Menu min-width: 200px (already set)
  Menu item padding: 8px 16px (already set)
```

---

## Open questions for architect

1. **Arrow key handler placement**: Implement as a `onKeyDown` on `MenuRoot` div, or migrate from Radix `Popover` to Radix `DropdownMenu` / `ContextMenu` (which manages arrow-key focus natively)? The latter would be a larger refactor but gives the correct ARIA pattern for free.

2. **Focus return trigger disambiguation**: The cleanest way to distinguish "keyboard dismiss" vs "click-outside dismiss" within Radix Popover. The brief proposes `onEscapeKeyDown` to set a flag; is there a Radix-idiomatic pattern preferred?

3. **Card open-state coordination**: The `LibraryRoute` already holds `contextRequest` state. The triggering card needs to know `contextRequest.id === its own id` to show the ring. Should this be a prop threaded through sections, or a context value, or a CSS `data-` attribute set on the button directly via the `handleContextMenuRequest` callback? Architect to decide.

4. **`recently-played` anchor ID**: `ContextMenuRequest.id` for recently-played items may be the underlying collection id (not necessarily unique within the grid). Confirm this is safe to use as the key for focus-return tracking.
