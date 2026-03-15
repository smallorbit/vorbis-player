# Tasks: Provider Toggles & Session Start Flow

## Relevant Files

- `src/components/controls/Switch.tsx` - New shared Switch toggle component extracted from QuickEffectsRow
- `src/components/controls/QuickEffectsRow.tsx` - Updated to use shared Switch component
- `src/components/VisualEffectsMenu/index.tsx` - MusicSourcesSection updated with Switch toggles + connection status
- `src/components/VisualEffectsMenu/styled.ts` - Updated/new styled components for provider rows
- `src/contexts/ProviderContext.tsx` - Added connectedProviderIds, auto-fallthrough logic
- `src/components/ProviderSetupScreen.tsx` - Redesigned welcome/reconnect/all-expired screens
- `src/components/AudioPlayer.tsx` - Updated needsSetup logic, toast state
- `src/components/Toast.tsx` - New lightweight toast notification component

## Tasks

- [ ] 1.0 Extract shared Switch component
  - [ ] 1.1 Create `src/components/controls/Switch.tsx` with `SwitchTrack`/`SwitchKnob` extracted from QuickEffectsRow, accepting `on`, `onToggle`, `ariaLabel`, and optional `disabled` props
  - [ ] 1.2 Update `QuickEffectsRow.tsx` to import and use the shared `Switch` component, removing inline `SwitchTrack`/`SwitchKnob` styled components

- [ ] 2.0 Replace settings menu provider toggles with Switch-based rows
  - [ ] 2.1 Update `MusicSourcesSection` to use rows with provider name, connection status indicator, and shared `Switch` component
  - [ ] 2.2 Add "Reconnect"/"Connect" action next to the switch when provider is enabled but not connected
  - [ ] 2.3 Ensure switch only controls enabled state, not OAuth; prevent disabling the last enabled provider

- [ ] 3.0 State model changes and auto-fallthrough
  - [ ] 3.1 Add `connectedProviderIds` derived state to `ProviderContext` — subset of `enabledProviderIds` whose auth is valid
  - [ ] 3.2 Add auto-fallthrough `useEffect` in `ProviderContext` — when active provider loses auth, switch to first valid enabled provider
  - [ ] 3.3 Update `needsSetup` logic in `AudioPlayer.tsx` to use `connectedProviderIds`
  - [ ] 3.4 Ensure `enabledProviderIds` persists independently of auth state (not cleared on token expiry)

- [ ] 4.0 Toast notification for auto-fallthrough
  - [ ] 4.1 Create lightweight `Toast` component with auto-dismiss (5s), dismissible, non-blocking
  - [ ] 4.2 Add toast state to `AudioPlayer` and render toast when auto-fallthrough triggers notification

- [ ] 5.0 Redesign ProviderSetupScreen
  - [ ] 5.1 Update first-time welcome screen: add Switch toggles per provider card + separate "Connect" button
  - [ ] 5.2 Show "Continue" button once at least one provider is connected; simplify for single-provider case
  - [ ] 5.3 Create all-expired reconnect screen: list each enabled provider with status + "Reconnect" button
  - [ ] 5.4 Auto-transition to player when any provider reconnects successfully
