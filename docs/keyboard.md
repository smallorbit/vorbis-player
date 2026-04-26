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
| `?` / `/` | Keyboard help | same |
| `Escape` | Close all menus | same |

`Q` and `L` are device-independent alternatives for drawer toggles. `↑`/`↓` have cross-dismiss behavior.
