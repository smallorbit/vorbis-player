## Context

Vorbis Player threads the "active album's accent color" through chrome via two CSS custom properties set on `:root` by `ColorContext` (`src/contexts/ColorContext.tsx:85-87`):

- `--accent-color` — the live accent hex
- `--accent-contrast-color` — a derived black/white that reads on top of it

shadcn primitives consume a parallel namespace (`--primary`, `--accent`, etc.) defined in `src/styles/shadcn-tokens.css`. The token comment is explicit: **`--primary` stays a static neutral so dialog chrome does not retint when the playing track changes**. This is correct for dialogs and settings drawers, but the flip-menu is the opposite case — it's the surface designed to feel like an extension of the album art, and its toggles (`Switch`) already use `var(--accent-color)` via `variant="accent"` (`src/components/ui/switch.tsx:42-43`).

The mismatch is in two places that bypass the Switch pattern:

1. `OptionButton` (`src/components/AppSettingsMenu/styled.ts:277-295`) hard-codes its active background/border to `hsl(var(--primary))`. It was originally written for the Settings drawer, then reused inside `QuickEffectsRow` for the Glow/Visualizer sub-setting pills. The drawer call sites want the static-white treatment; the flip-menu call sites want accent.
2. `SwatchButton` (`src/components/controls/QuickEffectsRow.tsx:70-82`) sets the active swatch's `border` to `theme.colors.white`, plus a `theme.colors.selection` outline. Combined with the swatch's own color (the candidate accent), this paints three different colors around the active swatch and competes for attention.

The user-visible artifact today: half the active controls in the flip menu glow with the album's color (Switches), the other half stay generic white (pills, swatch border). The proposal makes them coherent.

## Goals / Non-Goals

**Goals:**

- Active state of every `OptionButton` rendered inside `QuickEffectsRow` reflects the current `--accent-color` for background/border, with foreground in `--accent-contrast-color` for legibility.
- Active `SwatchButton` indicator stops competing with the swatch color itself.
- Other `OptionButton` call sites (Quick Access Panel, Performance Profiler, Visualizer Debug in the Settings drawer) keep their current static-white active treatment.
- Zero behavioral change — same controls toggle the same values; only paint differs.
- No new dependencies, no new exported types beyond the variant prop.

**Non-Goals:**

- Restyling the Settings drawer (`AppSettingsMenu/index.tsx`) or Settings v2 sections.
- Changing the `--primary` shadcn token or the `Switch` component.
- Replacing `OptionButton` with shadcn's `ToggleGroup`. That's a larger migration tracked separately.
- Adding theme-bridge documentation beyond updating the inline comment on `OptionButton` to mention the new variant.

## Decisions

### Decision 1 — Add a `variant` prop to `OptionButton`, default `neutral`

**Choice:** Add a `$variant: 'accent' | 'neutral'` transient styled-components prop. When `accent`, the active branch uses `var(--accent-color)` / `var(--accent-contrast-color)` (matching the CSS variables already published by `ColorContext`). When `neutral` (default), behavior is unchanged from today.

**Why:**

- Mirrors the `Switch` component's existing `variant` API, so the codebase already has a precedent and reviewers can pattern-match.
- Default-`neutral` means zero risk of regressing the Settings-drawer call sites that consume `OptionButton` today — they don't pass the prop, so they keep the existing styling.
- A transient prop (`$variant`) keeps styled-components from forwarding the attribute to the DOM, avoiding React's unknown-prop warning.

**Alternatives considered:**

- *Inline `style={{ background: ... }}` overrides at each `QuickEffectsRow` call site.* Rejected — would require recomputing the contrast color in JSX, leaks styling concerns into the consumer, and forks state-vs-hover styles awkwardly.
- *Duplicate the styled component (`AccentOptionButton`) inside `QuickEffectsRow`.* Rejected — duplicates 18 lines of styling plus the hover variants, risks drift over time.
- *Tailwind `data-state` attribute hooks.* Rejected — the existing component is plain styled-components, not Radix; introducing a new state attribute is more refactor than the change warrants.

### Decision 2 — Active `SwatchButton` indicator: drop the white border, keep the `selection` outline

**Choice:** Remove the `2px solid theme.colors.white` border on the active swatch and rely on the existing `outline: 2px solid theme.colors.selection` plus a small extra inset shadow if visual weight needs restoring. If the outline alone reads as too subtle in QA, fall back to `border: 2px solid var(--accent-color)` — the same hue as the swatch itself but rendered as a halo via a thin gap between border and inner background.

**Why:**

- Painting white around a colored swatch fights the swatch's own color and reads as a foreign element on the accent-tinted backside.
- The `theme.colors.selection` outline is already in place and was the original "selected" affordance before the white border was added.
- Keeping the fallback option (`border: 2px solid var(--accent-color)`) gives the implementer room during QA without re-litigating the design.

**Alternatives considered:**

- *Color the active swatch border with `--accent-contrast-color`.* Rejected — the contrast color is computed *against* the accent, so on a near-white accent it would render as near-black, which reads as a dropped shadow rather than a selection ring.

### Decision 3 — Hover state of accent-variant `OptionButton`

**Choice:** Active-hover keeps `var(--accent-color)` at slightly reduced alpha (e.g. `color-mix(in srgb, var(--accent-color) 87%, transparent)`), matching the existing `hsl(var(--primary) / 0.87)` pattern in the neutral variant.

**Why:** Symmetry with the neutral variant's hover treatment. `color-mix` is supported in all evergreen browsers Vorbis Player targets (per `vite.config.ts` ES2020 baseline + Safari TP). Inactive-hover stays unchanged (`hsl(var(--muted))` / `theme.colors.white` foreground) so unselected pills don't preview the accent on every mouseover.

### Decision 4 — `accentColor` is consumed via CSS variable, not React prop

**Choice:** The styled component reads `var(--accent-color)` directly from the cascade rather than receiving the accent hex as a prop from `QuickEffectsRow`.

**Why:** `ColorContext` already publishes both CSS variables globally on `:root` and updates them in a `useEffect` whenever the accent changes (`ColorContext.tsx:84-88`). Reading via CSS means the styling reacts to accent changes without any React-render coupling, matches how Switch / BottomBar / TimelineSlider consume the accent, and avoids threading another prop through `QuickEffectsRow` → `OptionButton`.

## Risks / Trade-offs

- **Risk:** Some album accents land on near-white (e.g., washed-out vintage covers) and the active pill becomes invisible on the flip-menu's translucent-dark backdrop.
  **Mitigation:** `--accent-contrast-color` already adapts (the helper in `src/utils/colorExtractor` picks black on near-white accents). The pill's foreground will flip to dark, retaining legibility. The backdrop is `rgba(0,0,0,0.7)` over a blurred album image — a near-white pill on a darkened background is the *intended* failure mode, the same one BottomBar accepts today.

- **Risk:** `color-mix` parsing differs across browsers older than what `vite.config.ts` targets.
  **Mitigation:** Limit `color-mix` to the hover override branch only; the base active state uses `var(--accent-color)` directly. If a target browser doesn't support `color-mix`, hover degrades to the same flat accent (no visual regression, just no hover dim).

- **Trade-off:** Adding a variant prop on `OptionButton` means future consumers must choose a side. We document the choice inline next to the existing styled component so the next contributor doesn't have to dig.

- **Risk:** Visual snapshot tests (`playwright/` captures) pinned to the flip menu will diff.
  **Mitigation:** Expected. Re-run `npm run capture` after the implementation lands and commit the new baseline. Call out in the PR.

## Spec strategy

`openspec/specs/` has no `visual-effects-menu` capability today — the flip-menu surface predates the OpenSpec adoption. Rather than ship this change as polish-only, this proposal also **seeds the first version** of `specs/visual-effects-menu/spec.md` from the current implementation, so the existing surface is durably documented and subsequent changes (e.g., adding a new visualizer style, exposing additional Glow controls, swapping the eyedropper) have a contract to extend.

Concretely the spec file is a single `## ADDED Requirements` block covering:

- the flip-menu surface (mount, dismiss, backdrop)
- accent color selection (extracted swatches, custom override, eyedropper, reset)
- glow / visualizer / translucence controls and their sub-settings
- the **new** requirement that every active control reflects the current accent color (the actual behavioral target of this change)

The first five requirements above describe pre-existing behavior. Including them in the seed spec is intentional: a capability spec that only documents the brand-new requirement would mislead future readers about the surface's scope. The spec describes the menu as a whole, not just the polish.
