# Refactoring Plan

## Strategic Goals
1.  **Decouple Persistence**: Move `localStorage` logic out of business logic hooks.
2.  **Standardize State**: Enforce the "Grouped State" pattern and remove legacy flat exports.
3.  **decompose Components**: Break down large orchestrator components into smaller, focused units.
4.  **Enhance Quality**: Fix linting errors and improve type safety.

## Architectural Decisions

### 1. Centralized Persistence (`useLocalStorage`)
We will introduce a generic `useLocalStorage<T>` hook.
**Benefits:**
- Removes JSON parse/stringify boilerplate.
- Provides a consistent API (`[value, setValue]`).
- Centralizes error handling for storage quotas or parsing failures.

**Signature:**
```typescript
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void]
```

### 2. Refactored `usePlayerState`
We will refactor `usePlayerState` to:
- Use `useLocalStorage` for all persisted fields.
- Return *only* the `GroupedPlayerState` interface structure (nested objects for `track`, `playlist`, `visualEffects`, etc.).
- Move unrelated logic (like specific Spotify event listeners) to dedicated hooks if possible.

### 3. Component Extraction (`AudioPlayer`)
We will split `AudioPlayer.tsx` into logical sub-units:
- **`PlayerLogic` (Hook)**: Encapsulates `useSpotifyPlayback`, auth handling, and shortcuts.
- **`PlayerLayout` (Component)**: Handles the visual structure (`Container`, `Background`).
- **`AudioPlayer` (Container)**: Wires the logic to the layout.

### 4. Cleanup & Standardization
- **Linting**: Fix all ESLint warnings, specifically around `useEffect` dependencies.
- **Dead Code**: Remove unused props and variables.
- **Imports**: Standardize on using `@/` aliases for internal imports to make moving files easier.

## Phased Approach

### Phase 1: Foundation (High Value, Low Risk)
- Implement `useLocalStorage`.
- Fix Lint/Type errors.
- Clean up dead code.

### Phase 2: State Refactoring (High Value, Medium Risk)
- Refactor `usePlayerState` to use `useLocalStorage`.
- Create a compatibility layer for `usePlayerState` to support legacy flat props temporarily if needed, but aim for immediate migration.

### Phase 3: Component Decomposition (Medium Value, Medium Risk)
- Refactor `AudioPlayer` to use the new Grouped State from Phase 2.
- Extract logic into `usePlayerLogic`.

### Phase 4: Polish
- Add missing integration tests.
- Standardize imports.
