# Task List: Fix Duplicate Accent Color State Management

Based on PRD: `0001-prd-fix-duplicate-accent-color-state.md`

## Relevant Files

- `src/hooks/usePlayerState.ts` - Contains first instance of accent color state management with `'accentColorOverrides'` key
- `src/hooks/useCustomAccentColors.ts` - Contains duplicate accent color state management with `'customAccentColorOverrides'` key (to be refactored into adapter)
- `src/hooks/usePlayerState.test.ts` - Unit tests for usePlayerState hook (to be created)
- `src/hooks/useCustomAccentColors.test.ts` - Unit tests for refactored useCustomAccentColors hook (to be created)
- `src/components/SpotifyPlayerControls.tsx` - Component that uses useCustomAccentColors hook (needs verification)
- `src/components/AudioPlayer.tsx` - Main component that may use accent color state (needs verification)
- `src/components/ColorPickerPopover.tsx` - Component that may interact with accent colors (needs verification)
- `src/components/controls/TimelineControls.tsx` - Component that may use accent colors (needs verification)
- `src/hooks/useAccentColor.ts` - Related hook for color extraction (may need verification)

### Notes

- Unit tests should be placed alongside the code files they are testing (e.g., `usePlayerState.ts` and `usePlayerState.test.ts` in the same directory)
- Use `npm test` to run all tests
- Use `npm run test:run` to run tests once without watch mode
- Use `npm run test:coverage` to check test coverage

## Tasks

- [ ] 1.0 Add localStorage cleanup on app initialization
  - [ ] 1.1 Create cleanup function to delete `'customAccentColorOverrides'` key
  - [ ] 1.2 Add cleanup function call in App.tsx initialization (useEffect on mount)
  - [ ] 1.3 Add try-catch error handling for localStorage access failures
  - [ ] 1.4 Verify cleanup runs successfully and deprecated key is deleted

- [ ] 2.0 Add accent color helper methods to usePlayerState
  - [ ] 2.1 Create `handleSetAccentColorOverride(trackId, color)` method that updates the overrides object
  - [ ] 2.2 Create `handleRemoveAccentColorOverride(trackId)` method that removes a track's override
  - [ ] 2.3 Create `handleResetAccentColorOverride(trackId)` method as alias for remove (for RESET_TO_DEFAULT support)
  - [ ] 2.4 Export these methods from usePlayerState hook return value
  - [ ] 2.5 Ensure methods use useCallback for performance

- [ ] 3.0 Refactor useCustomAccentColors to be an adapter
  - [ ] 3.1 Import usePlayerState hook at the top of useCustomAccentColors
  - [ ] 3.2 Remove local state (`customAccentColorOverrides`, `setCustomAccentColorOverrides`)
  - [ ] 3.3 Remove all localStorage logic (both useEffect hooks for load/save)
  - [ ] 3.4 Get `accentColorOverrides` and helper methods from usePlayerState
  - [ ] 3.5 Refactor `handleCustomAccentColor` to use `handleSetAccentColorOverride` from usePlayerState
  - [ ] 3.6 Refactor `handleAccentColorChange` to use helper methods from usePlayerState
  - [ ] 3.7 Return `accentColorOverrides` renamed as `customAccentColorOverrides` for API compatibility
  - [ ] 3.8 Verify adapter maintains same API interface for consuming components

- [ ] 4.0 Create comprehensive unit tests
  - [ ] 4.1 Create `src/hooks/usePlayerState.test.ts` test file
  - [ ] 4.2 Write test: "should load accent color overrides from localStorage on mount"
  - [ ] 4.3 Write test: "should save accent color overrides to localStorage when changed"
  - [ ] 4.4 Write test: "should add accent color override for a track"
  - [ ] 4.5 Write test: "should remove accent color override for a track"
  - [ ] 4.6 Write test: "should handle RESET_TO_DEFAULT correctly"
  - [ ] 4.7 Create `src/hooks/useCustomAccentColors.test.ts` test file
  - [ ] 4.8 Write test: "should return accent color overrides from usePlayerState"
  - [ ] 4.9 Write test: "should delegate handleCustomAccentColor to usePlayerState"
  - [ ] 4.10 Write test: "should delegate handleAccentColorChange to usePlayerState"
  - [ ] 4.11 Write test for localStorage cleanup: "should delete customAccentColorOverrides key on mount"
  - [ ] 4.12 Run tests and ensure >80% coverage of accent color logic

- [ ] 5.0 Verify all components work correctly
  - [ ] 5.1 Test SpotifyPlayerControls component - verify color picker works
  - [ ] 5.2 Test AudioPlayer component - verify accent colors display correctly
  - [ ] 5.3 Test ColorPickerPopover component - verify custom colors can be set
  - [ ] 5.4 Test TimelineControls component - verify accent colors apply to timeline
  - [ ] 5.5 Manual test: Set custom accent color for a track and verify it persists after refresh
  - [ ] 5.6 Manual test: Verify only `'accentColorOverrides'` key exists in localStorage
  - [ ] 5.7 Run full test suite (`npm test`) and ensure all tests pass
  - [ ] 5.8 Check browser console for any React warnings or errors

---

**Status:** Phase 2 - Sub-tasks generated, ready for implementation
