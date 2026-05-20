## 1. Spec reconciliation

- [x] 1.1 In `openspec/changes/flip-menu-gesture-spec-reconcile/specs/visual-effects-menu/spec.md`, modify the `Flip-Menu Surface` requirement so the prose lists the actual gesture matrix (tap outside zen, long-press inside zen, click on pointer) and the "Opening the flip menu" scenario splits into three modality clauses with a shared THEN.
- [x] 1.2 Leave all other requirements (`Accent Color Selection`, `Glow Control`, `Background Visualizer Control`, `Translucence Control`, `Active Controls Reflect Current Accent Color`) and their scenarios out of the delta.

## 2. Verification

- [x] 2.1 Run `npx tsc -b --noEmit` — confirm no new errors (spec-only change should be a no-op for TypeScript).
- [x] 2.2 Run `npm run test:run` — confirm green (no test asserts against spec text).
- [x] 2.3 Run `npm run build` — confirm clean production build.

## 3. Archive

- [ ] 3.1 After PR #1560 merges, run `/opsx:archive flip-menu-gesture-spec-reconcile` so the delta is merged into `openspec/specs/visual-effects-menu/spec.md`.
