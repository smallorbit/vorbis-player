# Refactoring Task Breakdown

This document outlines the specific tasks required to execute the refactoring plan. These tasks are designed to be executed sequentially.

## Phase 1: Foundation & Cleanup

### Task 1.1: Implement `useLocalStorage` Hook (COMPLETED)
**Goal**: Create a reusable hook for persistent state.
1.  Create `src/hooks/useLocalStorage.ts`.
2.  Implement the hook to handle:
    - Reading from `localStorage` on initialization.
    - Parsing JSON safely (try/catch).
    - Saving to `localStorage` on value change.
    - Listening for `storage` events (optional, but good for multi-tab sync).
3.  Add tests in `src/hooks/__tests__/useLocalStorage.test.ts`.

### Task 1.2: Fix Linting Errors (COMPLETED)
**Goal**: Ensure a clean working state.
1.  Run `npm run lint`.
2.  Fix `VisualEffectsContainer.tsx`: Remove or rename `_enabled`.
3.  Fix `QuickActionsPanel.tsx`: Remove unused variables.
4.  Fix `Visualizers` (`GeometricVisualizer.tsx`, etc.):
    - Add missing dependencies to `useEffect`.
    - Use `useCallback` for functions used in effects.
    - Remove unused `_playbackPosition`.

### Task 1.3: Standardize Imports (PARTIALLY COMPLETED)
**Goal**: Prepare for file moves.
1.  Update `tsconfig.json` to ensure paths `@/*` are correctly configured (if not already).
2.  Replace relative imports like `../../components` with `@/components` where appropriate in `src/components` and `src/hooks`. (Done for `AudioPlayer.tsx` and `usePlayerLogic.ts`)

## Phase 2: State Management Refactoring

### Task 2.1: Refactor `usePlayerState` Persistence (COMPLETED)
**Goal**: Simplify `usePlayerState` internals.
1.  Import `useLocalStorage`.
2.  Replace manual `useState` + `useEffect` pairs with `useLocalStorage` for:
    - `visualEffectsEnabled`
    - `perAlbumGlow`
    - `albumFilters`
    - `backgroundVisualizerEnabled`, etc.
3.  Verify that the behavior (default values, persistence) remains the same.

### Task 2.2: Enforce Grouped State in `usePlayerState` (COMPLETED)
**Goal**: Clean up the public API of the hook.
1.  Modify the return statement of `usePlayerState`.
2.  Ensure the `GroupedPlayerState` structure (`track`, `playlist`, `color`, `visualEffects`, `actions`) contains *all* necessary data.
3.  **Crucial**: Identify all consumers of `usePlayerState` (using Grep) and update them to destructure from the groups (e.g., `const { track } = usePlayerState()` instead of `const { tracks } = ...`).
4.  Once all consumers are updated, remove the "Legacy individual state" exports from the hook.

## Phase 3: Component Architecture

### Task 3.1: Extract `AudioPlayer` Logic (COMPLETED)
**Goal**: Slim down `AudioPlayer.tsx`.
1.  Create `src/hooks/usePlayerLogic.ts`.
2.  Move the following logic from `AudioPlayer.tsx` to this new hook:
    - `useDebugModeShortcut`
    - `useSpotifyPlayback` integration
    - `usePlaylistManager` integration
    - `useAutoAdvance` integration
    - `useEffect` for Spotify authentication redirect
    - `useEffect` for `spotifyPlayer.onPlayerStateChanged`
3.  Return the necessary state and handlers from `usePlayerLogic`.

### Task 3.2: Refactor `AudioPlayer` Component (COMPLETED)
**Goal**: Make `AudioPlayer` purely presentational (or close to it).
1.  Update `AudioPlayer.tsx` to use `usePlayerLogic`.
2.  Update `AudioPlayer.tsx` to use the new Grouped State from `usePlayerState` (if not done in Task 2.2).
3.  Verify that all props passed to `PlayerContent` and `PlayerStateRenderer` are still correct.

### Task 3.3: Memoization Audit (PENDING)
**Goal**: Optimize performance.
1.  Review `AudioPlayer.tsx` and `PlayerContent.tsx`.
2.  Ensure all event handlers passed as props are wrapped in `useCallback`.
3.  Ensure expensive components (like `VisualEffectsMenu` or large lists) are wrapped in `React.memo`.

## Validation

### Verification Steps
1.  Run `npm run build` to ensure no type errors. (Done - Passed)
2.  Run `npm run lint` to ensure no lint errors. (Done - Passed with minor warnings in other files)
3.  Run `npm test` to verify no regressions in existing tests. (Done - Passed)
4.  Manual QA:
    - Check if settings (Visual Effects, filters) persist after refresh.
    - Check if Spotify playback works.
    - Check if Playlist navigation works.
