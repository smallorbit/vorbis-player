# Source layering

Dependency ladder for `src/` (#1733 / F76). Each layer may import only from layers **below** it.

| Layer | Paths |
|-------|--------|
| 1 — Foundation | `types/`, `constants/` |
| 2 — Platform | `lib/`, `utils/`, `workers/`, `styles/` |
| 3 — Engine | `services/`, `stores/` |
| 4 — Providers | `providers/` (implementations; not `contexts/`) |
| 5 — App logic | `hooks/`, `contexts/` |
| 6 — UI | `components/`, `App.tsx`, `main.tsx` |

Cross-cutting rules already enforced elsewhere:

- Domain types live in `src/types/`.
- No raw `localStorage` outside `persistedStorage.ts`.
- Storage keys only in `constants/storage.ts`.

## Tooling

- **ESLint:** `import/no-restricted-paths` zones in `eslint.config.js` (production `src/`, excludes tests).
- **CI:** `npm run check:circular` — `madge` must report zero cycles on `src/`.

## Breaking cycles

Prefer leaf modules (shared types, token/auth handles, registry in `services/`) and `import type` at boundaries. Do not disable the circular-import check.
