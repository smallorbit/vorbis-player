# Testing Guide

Run with `npm run test:run`. Tests are colocated with source files in `__tests__/` subdirectories.

- Verify actual behavior, not mock implementations
- Every test should have meaningful assertions

CI runs `npm run test:coverage`, `npm run knip`, and `npm run audit:ci`. Coverage is reported for visibility (`vite.config.ts` → `test.coverage`); there are no minimum thresholds.

Playwright (`npm run test:e2e`) boots the **production build** via `npm run preview:e2e` (mock provider baked in at build time). Fixture preconditions in `playwright/fixtures/require-snapshot.ts` throw on empty snapshots so CI cannot silently skip cross-provider specs.

## Test utilities (`src/test/`)

| File | Purpose |
|------|---------|
| `setup.ts` | Global test setup: mocks `localStorage`, `sessionStorage`, `window.location`, `history`, `window.matchMedia`, `fetch`, `crypto` (for PKCE), `btoa`/`atob`; imports `fake-indexeddb/auto` and `@testing-library/jest-dom`; clears all mocks in `afterEach` |
| `fixtures.ts` | Factory functions for domain objects: `makeTrack()`, `makeMediaTrack()`, `makeProviderDescriptor()` — all accept partial overrides |
| `testWrappers.tsx` | `TestWrapper` component that nests all app context providers (`ThemeProvider`, `ProviderProvider`, `PlayerSizingProvider`, `TrackProvider`, `ColorProvider`, `VisualEffectsProvider`, `PinnedItemsProvider`) for component/hook tests |
| `providerTestUtils.tsx` | `ProviderWrapper` — lighter wrapper with only `ProviderProvider`, for hooks that only need provider context |
| `axe.ts` | `expectNoAxeViolations(container)` — `vitest-axe` scan against WCAG 2.1 A/AA (contrast disabled: jsdom has no layout) |

## Accessibility gates

Accessibility is checked at two levels, and both run in CI:

- **Unit (`src/test/axe.ts`)** — call `expectNoAxeViolations(container)` in component tests for interactive surfaces (queue list in both modes, queue drawer, library card). Catches structural ARIA problems such as nested interactive controls or unnamed widgets.
- **Playwright (`playwright/fixtures/axe.ts`)** — `a11y-axe.spec.ts` scans library, player, queue, app settings, and keyboard help at both viewports with `@axe-core/playwright`, including color contrast against real rendering.
- **`keyboard-journey.spec.ts`** — the WS6 exit criterion: browse, play, queue, select, reorder, remove, and Escape using only Tab/Enter/Space/arrows, with focus moving into the queue dialog and back to its opener.

Don't silence a rule to get green. If a rule genuinely cannot apply to a surface, pass `disableRules` at that call site with a comment saying why.

## BDD comment convention

Tests use `// #given`, `// #when`, `// #then` comments to mark the Arrange-Act-Assert phases:

```ts
it('loads volume from localStorage on init', () => {
  // #given
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'vorbis-player-volume') return '75';
    return null;
  });

  // #when
  const { result } = renderHook(() => useVolume(), { wrapper: ProviderWrapper });

  // #then
  expect(result.current.volume).toBe(75);
});
```

Use this pattern in all new tests. The `#given` section is optional when there is no setup beyond what `beforeEach` provides.
