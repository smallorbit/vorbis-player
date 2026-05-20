# Tasks — active-swatch-accent-outline

## 1. Implementation

- [x] 1.1 Update `src/components/controls/QuickEffectsRow.tsx:76` — replace `2px solid ${theme.colors.selection}` with `2px solid var(--accent-contrast-color)` for the active swatch outline.
- [x] 1.2 Drop the unused `theme` arg from that styled getter (purely cosmetic; no behavior change).

## 2. Spec delta

- [x] 2.1 Add a swatch-specific clarification under the `visual-effects-menu` "Active Controls Reflect Current Accent Color" requirement noting that the active-swatch outline uses `--accent-contrast-color` (because the swatch fill itself is the accent).

## 3. Verification

- [x] 3.1 `npx tsc -b --noEmit` — clean.
- [x] 3.2 `npm run test:run` — green (no existing test asserts on the outline color; `QuickEffectsRow.test.tsx` only checks `$variant="accent"` on OptionButtons).
- [x] 3.3 `npm run build` — green.
- [x] 3.4 Manual check (deferred to PR review): toggle accent color via the flip menu and confirm the active-swatch outline follows the contrast color, remaining clearly visible across light and dark accents.
