# Keyboard Shortcuts Quick Reference

## Playback Controls
| Shortcut | Action |
|----------|--------|
| **Space** | Play/Pause |
| **← Arrow Left** | Previous track |
| **→ Arrow Right** | Next track |

## Playlist & Library
| Shortcut | Action |
|----------|--------|
| **P** | Toggle playlist drawer |
| **H** | Like/Unlike current track |

## Audio Controls
| Shortcut | Action |
|----------|--------|
| **M** | Mute/Unmute |
| **↑ Arrow Up** | Volume up (reserved for future) |
| **↓ Arrow Down** | Volume down (reserved for future) |

## Visual Effects
| Shortcut | Action |
|----------|--------|
| **G** | Toggle glow effect |
| **V** | Toggle background visualizations |
| **O** | Open visual effects menu |

## Interface
| Shortcut | Action |
|----------|--------|
| **/** or **?** | Show keyboard shortcuts help |
| **Esc** | Close all menus & modals |

## Developer
| Shortcut | Action |
|----------|--------|
| **D** | Toggle debug mode (debug mode enabled only) |

## Notes

- Keyboard shortcuts are disabled when typing in **input fields** or **textarea** elements
- Shortcuts are also disabled in **contentEditable** elements (like Slack-style editors)
- Modifier keys (Ctrl/Cmd) should NOT be used with single-letter shortcuts
  - Exception: Some shortcuts may be blocked if Ctrl/Cmd is pressed (e.g., Ctrl+P is browser print)

## Implementation

Keyboard shortcuts are centralized in the `useKeyboardShortcuts` hook:
- **Location:** `src/hooks/useKeyboardShortcuts.ts`
- **Integration:** Wired through `PlayerContent` component
- **Handlers:** Provided by `usePlayerLogic` hook

## For Developers

To add a new keyboard shortcut:

1. Add the handler to `KeyboardShortcutHandlers` interface in `useKeyboardShortcuts.ts`
2. Add the key case in the `handleKeyDown` switch statement
3. Add the handler prop to the `useKeyboardShortcuts` call in `PlayerContent.tsx`
4. Pass the handler from `usePlayerLogic` through `AudioPlayer.tsx` → `PlayerContent.tsx`
5. Update this documentation and `KeyboardShortcutsHelp.tsx` if user-facing
6. Add tests to `useKeyboardShortcuts.test.ts`

See `KEYBOARD_SHORTCUTS_VERIFICATION.md` for detailed implementation information.
