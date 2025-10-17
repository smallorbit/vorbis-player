# PRD: Fix Duplicate Accent Color State Management

## Introduction/Overview

The Vorbis Player application currently has a critical bug where accent color overrides are managed by two different hooks (`usePlayerState` and `useCustomAccentColors`) using two separate localStorage keys (`'accentColorOverrides'` and `'customAccentColorOverrides'`). This creates data synchronization issues, inconsistent user experience, and potential data loss when users set custom colors for tracks.

**Problem:** When a user sets a custom accent color for a track, the color may be saved to one localStorage key but read from another, causing the override to not apply correctly or to be lost.

**Goal:** Eliminate the duplicate state management by consolidating all accent color override functionality into a single source of truth (`usePlayerState`), ensuring consistent and reliable color persistence across user sessions.

## Goals

1. **Single Source of Truth:** Consolidate all accent color state management into `usePlayerState` hook
2. **Data Integrity:** Ensure no data synchronization bugs or race conditions between hooks
3. **Consistent Persistence:** Use a single localStorage key for all accent color overrides
4. **Code Quality:** Ensure the fix is properly tested with unit tests
5. **Clear Documentation:** Update relevant documentation to reflect the new state management architecture

## User Stories

1. **As a user**, I want my custom accent colors to persist reliably across sessions, so that I don't lose my color preferences when I close and reopen the app.

2. **As a user**, I want consistent color behavior throughout the app, so that setting a custom color in one place applies everywhere that track appears.

3. **As a developer**, I want a single, clear API for managing accent colors, so that I don't have to guess which hook or state to use.

4. **As a maintainer**, I want unit tests covering state management, so that future changes don't reintroduce this bug.

## Functional Requirements

### FR1: State Management Consolidation
The `usePlayerState` hook must be the single source of truth for all accent color override state. All accent color override logic must be removed from `useCustomAccentColors`.

### FR2: localStorage Key Consolidation
The application must use only one localStorage key for accent color overrides: `'accentColorOverrides'`. The key `'customAccentColorOverrides'` must no longer be used.

### FR3: localStorage Cleanup
On application load, the system must delete the deprecated `'customAccentColorOverrides'` key from localStorage if it exists. No data migration or merging is required - this is a fresh start bug fix.

### FR4: Hook Refactoring
The `useCustomAccentColors` hook must be refactored to:
1. Import accent color state and setters from `usePlayerState`
2. Provide the same API interface for components that use it (to minimize breaking changes)
3. Act as a pass-through/adapter layer rather than managing its own state

### FR5: Component Updates
All components that use accent color overrides must be verified to work correctly with the consolidated state management.

### FR6: Unit Testing
Unit tests must be written for:
1. The accent color state management logic in `usePlayerState`
2. The localStorage cleanup logic (deleting deprecated key)
3. The refactored `useCustomAccentColors` hook behavior

## Non-Goals (Out of Scope)

The following are explicitly **not** included in this fix:

1. **Performance Optimizations:** Beyond the inherent improvement from eliminating duplicate state, no additional performance work
2. **Other State Management Refactoring:** Only accent color state is addressed; other state patterns remain unchanged
3. **UI/UX Changes:** No changes to the color picker interface or user interaction flows
4. **New Color Features:** No new color-related functionality (e.g., color palettes, color history)
5. **Visual Effects State:** Other visual effects state management remains unchanged

## Design Considerations

### Architecture Decision
- **Source of Truth:** `usePlayerState` was chosen as the source of truth because it already serves as the centralized state management hub for the player, making it the logical place for accent color overrides.

### API Compatibility
- The `useCustomAccentColors` hook will remain as an adapter layer to minimize breaking changes in components that currently use it, but it will delegate all state operations to `usePlayerState`.

## Technical Considerations

### Cleanup Strategy
A simple cleanup function should run on app initialization to remove the deprecated `'customAccentColorOverrides'` key from localStorage if it exists. This is a one-time operation.

### Error Handling
The cleanup logic should handle localStorage errors gracefully (e.g., permissions issues) and continue app initialization even if cleanup fails. Cleanup failures should be logged but not block the app.

### TypeScript Types
All accent color state should use consistent TypeScript types across both hooks.

## Success Metrics

The fix will be considered successful when:

1. ✅ **Single localStorage Key:** Only `'accentColorOverrides'` exists in localStorage; `'customAccentColorOverrides'` is not used
2. ✅ **Consistent Behavior:** Color overrides work consistently across all components and sessions
3. ✅ **No Console Errors:** No errors related to state synchronization or undefined state
4. ✅ **Component Functionality:** All components using accent colors function correctly
5. ✅ **Test Coverage:** Unit tests pass and cover the state management logic

### Verification Checklist
- [ ] Search codebase for `'customAccentColorOverrides'` returns zero results (except in cleanup code)
- [ ] All components using `useCustomAccentColors` work correctly
- [ ] localStorage contains only `'accentColorOverrides'` key after app runs (deprecated key is deleted)
- [ ] Unit tests achieve >80% coverage of accent color state logic
- [ ] Manual testing confirms colors persist across sessions
- [ ] No React warnings or errors in console related to state

## Open Questions

1. Should the cleanup logic run on every app load, or should we add a flag to track that cleanup has been performed?
2. Should we add console logging when the deprecated key is deleted, for debugging purposes?

---

**Document Version:** 1.0
**Created:** 2025-10-17
**Author:** Generated via AI Assistant
**Status:** Ready for Implementation
