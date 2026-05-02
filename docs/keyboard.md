# Keyboard Shortcuts

Centralized in `useKeyboardShortcuts.ts`. Uses `pointer: fine` / `hover: hover` media queries (not viewport width) to detect device type.

| Key | Desktop | Touch-only |
|-----|---------|------------|
| `Space` | Play/Pause | Play/Pause |
| `←` / `→` | Prev/Next track | Prev/Next track |
| `↑` / `Q` | Toggle queue | Volume up (↑ only) |
| `↓` / `L` | Toggle library | Volume down (↓ only) |
| `V` / `G` / `S` / `T` | Visualizer / Glow / Shuffle / Translucence | same |
| `Z` | Toggle zen mode | same |
| `O` / `K` / `M` | Effects menu / Like / Mute | same |
| `Cmd+K` / `Ctrl+K` | Open command palette (search library) | not bound |
| `?` / `/` | Keyboard help | same |
| `Escape` | Close all menus | same |

`Q` and `L` are device-independent alternatives for drawer toggles. `↑`/`↓` have cross-dismiss behavior.

The command palette (`Cmd+K` / `Ctrl+K`) lives in `src/components/CmdKPalette/` and registers its own `keydown` listener — separate from `useKeyboardShortcuts.ts`. Inside the palette, ↑/↓ navigate results and Enter selects (handled natively by `cmdk`). The palette does not mount on touch devices.
