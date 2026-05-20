# Design — active-swatch-accent-outline

## Context

`QuickEffectsRow.tsx` renders accent-color swatches as 24×24 circles whose fill *is* the candidate accent color. The currently-active swatch (where `color.hex === accentColor`) needs a visual differentiator. Today that differentiator is a 2px solid outline in `theme.colors.selection` (`#ffd700` gold).

Every other active state in the flip menu — option-button pills via `$variant="accent"`, switch tracks — already derives from `var(--accent-color)` (and `var(--accent-contrast-color)` for foregrounds). The swatch was deliberately skipped per the merge note in `b1e72ac`, but the visual-effects-menu spec enumerates the swatch as a control that MUST reflect the accent. The spec is the durable contract; the implementation should follow it.

## Decision

Use `var(--accent-contrast-color)` for the active-swatch outline.

### Why not `var(--accent-color)`?

The active swatch's `background` is the accent color. An outline in the same color would be invisible — defeating the purpose of marking it as active.

### Why `var(--accent-contrast-color)`?

- It's already wired up: `ColorContext` calls `getContrastColor(accentColor)` and sets the CSS variable alongside `--accent-color` on every accent change (`src/contexts/ColorContext.tsx:86`). Other components use it as a paired foreground (e.g. `LikeButton.tsx:86,90`).
- It guarantees visibility against the swatch fill by construction (it's the WCAG-passing contrast of the accent).
- The visual-effects-menu spec's "Active Controls Reflect Current Accent Color" requirement explicitly permits `--accent-contrast-color` as a derived value.

### Why not a two-color ring (e.g. 2px outline + 1px inner shadow)?

Considered, then rejected: it adds box-shadow geometry to fix a problem that `--accent-contrast-color` already solves cleanly. The simpler rule wins.

### Why keep `theme.colors.selection` in `theme.ts`?

It's a generic UI-state token (potential future use: highlighting selected rows, command-palette hits, etc.). Removing it on the back of this single-site refactor is out of scope; the token is left alone.

## Implementation

`src/components/controls/QuickEffectsRow.tsx:76`:

```ts
outline: ${({ $isActive }) => ($isActive ? `2px solid var(--accent-contrast-color)` : 'none')};
```

The `theme` arg is no longer needed in that styled-component getter, but is also harmless to leave; removing it is a minor cleanup commensurate with the fix.

## Risks

- **Low contrast for `--accent-contrast-color` when accent is a mid-tone gray.** `getContrastColor` returns either pure black or pure white based on the accent's luminance, so the outline will always be one of those two — both read clearly against a single colored disc. No new contrast risk.
- **Tests.** `src/components/controls/__tests__/QuickEffectsRow.test.tsx` asserts `$variant="accent"` on `OptionButton`s — it does not touch the swatch outline. No test updates required.

## Alternatives Considered

| Option | Verdict |
|---|---|
| Keep static gold outline | Rejected — violates spec, motivates this issue |
| Outline in `var(--accent-color)` | Rejected — invisible against active swatch's accent fill |
| 2px `--accent-color` + inner 1px `--accent-contrast-color` ring via `box-shadow` | Rejected — extra geometry, no upside over single-color contrast outline |
| Add a new theme token `theme.colors.swatchActiveOutline = var(--accent-contrast-color)` | Rejected — adds indirection without helping any other call site; the CSS variable is the project's canonical accent plumbing |
