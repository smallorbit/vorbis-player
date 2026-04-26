# shadcn/ui Integration

vorbis-player uses a hybrid styling stack: **styled-components for bespoke surfaces, shadcn/ui (Radix primitives + Tailwind) for chrome**. Both coexist permanently.

## Stack coexistence rule — pick by surface type

| Surface type | Stack | Examples |
|---|---|---|
| Visualizers, animations, gestures | styled-components (forever) | `BackgroundVisualizer`, zen-mode orchestration in `PlayerContent/styled.ts`, swipe gestures, album-art flip menu, `BottomBar` |
| Standard chrome (modals, sliders, popovers, switches, toasts) | shadcn primitives | `src/components/ui/*.tsx`: `dialog.tsx`, `button.tsx`, `slider.tsx`, `switch.tsx`, `accordion.tsx`, `popover.tsx`, `sonner.tsx` |
| Whole-screen redesigns | shadcn, gated behind `?ui=v2` | future `SettingsV2`, `OnboardingV2`, command palette |

## Theme bridge — `--accent-color` is player chrome ONLY

The runtime `--accent-color` / `--accent-contrast-color` (injected on `document.documentElement` by `ColorContext.tsx`) belong exclusively to player chrome that intentionally retints with the playing track:

- `BottomBar` (background tint, control hover states)
- `LikeButton` (filled state)
- `TimelineSlider` (fill + thumb gradient — wraps shadcn `slider.tsx`)
- `VolumeSlider` (fill + thumb gradient — wraps shadcn `slider.tsx`, vertical orientation)
- `Switch` accent variant (`controls/QuickEffectsRow.tsx` glow/visualizer/translucence toggles — uses default `variant="accent"` of `src/components/ui/switch.tsx`, retints checked-state track with `var(--accent-color)`)
- Glow effects (`--glow-intensity`, `--glow-rate`, `--glow-opacity`)
- Accent color overrides menu in `VisualEffectsMenu`

**shadcn primitives use the neutral palette** defined in `src/styles/shadcn-tokens.css` (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, etc.). shadcn's `--accent` token is a static neutral surface and is **not** the same as the player's `--accent-color`. Never wire shadcn's `--primary` or `--accent` to `var(--accent-color)` — dialogs, popovers, and other chrome must stay neutral so they don't retint per track.

## `?ui=v2` flag mechanism

The `useUiV2()` hook (`src/hooks/useUiV2.ts`) returns `true` when EITHER:

- `import.meta.env.VITE_UI_V2 === 'true'` (build-time opt-in for staging deploys), OR
- the URL contains `?ui=v2` (per-session opt-in for testing).

It subscribes to `popstate` so SPA navigation flips the flag without a reload. SSR-safe.

Convention for flagged screens:

- Components consuming the flag render the **legacy** path by default.
- The v2 branch lives under `if (uiV2) { … }`.
- Future redesign components are colocated next to the legacy file as `<ScreenName>V2.tsx` (e.g. `Settings.tsx` + `SettingsV2.tsx`). The parent component picks one or the other via `useUiV2()`.

## Current shadcn primitives

| Primitive | File | Notes |
|---|---|---|
| `Dialog` | `dialog.tsx` | Used by `ProviderDisconnectDialog`, `ConfirmDeleteDialog`, `SaveQueueDialog`, `KeyboardShortcutsHelp`. Unflagged. |
| `Slider` | `slider.tsx` | Wrapped by `TimelineSlider` (horizontal, accent fill/thumb gradient) and `VolumeSlider` (vertical). Per-part `trackStyle` / `thumbStyle` / `rangeStyle` escape hatches preserve accent retinting. |
| `Switch` | `switch.tsx` | Dual variants: `accent` (default, player chrome) and `neutral` (settings toggles). |
| `Toast` (Sonner) | `sonner.tsx` | `<Toaster />` mounted at app root in `App.tsx`. `RadioProgressContent` rendered via `toast.custom()`. |
| `Popover` | `popover.tsx` | Used by `TrackInfoPopover` via virtual-anchor pattern (zero-size fixed div positioned at `anchorRect` coordinates) so consumer call sites stay unchanged. |
| `Accordion` | `accordion.tsx` | Used by `AppSettingsMenu` — each section is its own `Accordion.Root` with `type="single" collapsible` to preserve independent open state. Tailwind keyframes `accordion-down` / `accordion-up` (200ms ease) defined in `tailwind.config.ts`. |

**Next-wave primitives** (tracked as on-hold epics; need decomposition via `/speckit:interview`): #1265 (FilterSidebar — shadcn wave 3), #1262 (Settings v2), #1263 (Cmd-K palette), #1264 (Onboarding v2).

## Canonical patterns for new shadcn primitives

When adding a new primitive in `src/components/ui/`:

- **Per-part style escape hatches** (from `slider.tsx` / `switch.tsx`): expose `trackStyle` / `thumbStyle` / `rangeStyle` props that pass through to the relevant Radix part. Lets player-chrome consumers retint via inline `var(--accent-color)` without polluting the primitive's neutral default. The primitive itself stays neutral; opt-in retinting happens at the call site.
- **z-index inline override** (from `dialog.tsx`): set `style={{ zIndex: <PRIMITIVE>_Z_INDEX, ...style }}` on the Content. Tailwind `z-50` is below the player's `BottomBar` (up to `theme.zIndex.modal` = 1400), so every primitive that renders above chrome needs an explicit override.
- **Virtual-anchor pattern** (from `popover.tsx`): when a consumer passes a DOMRect rather than wrapping `<PopoverTrigger>`, render a hidden zero-size `aria-hidden` `<PopoverAnchor asChild>` `<div style={{ position: 'fixed', left: rect.left + rect.width/2, top: rect.bottom, width: 0, height: 0, pointerEvents: 'none' }} />` and let Radix position relative to it.
- **`onOpenChange` handles both gestures** (from `Popover` migration): when `<Popover open onOpenChange={(open) => !open && onClose()}>` is used, do NOT also wire `onPointerDownOutside={onClose}` and `onEscapeKeyDown={onClose}` — Radix invokes `onOpenChange(false)` for both, and the explicit handlers double-fire. The single `onOpenChange` path is sufficient.
- **`motion-reduce:` Tailwind variants** on animation classes — every primitive with entry/exit or transform animations should include `motion-reduce:animate-none` (or equivalent) to respect `prefers-reduced-motion`.

## z-index for shadcn primitives

shadcn defaults to `z-50` (Tailwind), which is below the player's `BottomBar` (up to `theme.zIndex.modal` = 1400). Each primitive that renders above chrome overrides via inline style:

| Primitive | z-index | Source |
|---|---|---|
| `dialog.tsx` | `1405` | `DIALOG_Z_INDEX` constant |
| `popover.tsx` | `1500` | `POPOVER_Z_INDEX` constant (matches `theme.zIndex.popover`) |
| `sonner.tsx` (Toast) | `1410` | inline `--z-index` CSS custom property on `<Toaster />` |
