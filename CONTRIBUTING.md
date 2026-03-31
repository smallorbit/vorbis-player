# Contributing

## Styling

**`styled-components` is the sole styling approach.**

- All component styles live in `styled.div` / `styled.button` etc. definitions co-located with the component.
- Design tokens (colors, spacing, breakpoints, shadows, border radii, z-indices) are exported from `src/styles/theme.ts`. Extend this file for new tokens.
- Shared CSS mixins (`flexCenter`, `buttonPrimary`, etc.) live in `src/styles/utils.ts`. Extend this file for new mixins.
- Shared keyframe animations live in `src/styles/animations.ts`.
- `src/index.css` is reserved for true browser resets and document-level base styles only (`:root` font stack, `body` margin/overflow, `input[type="range"]` thumb, iOS/Android quirks). Do not add utility classes or component styles there.
- **Do not add CSS Modules or plain global utility classes.** If a pattern needs to be shared, extract it into `src/styles/utils.ts` as a styled-components mixin.
