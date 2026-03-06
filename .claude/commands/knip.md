Use knip to identify code that can be removed. Leverage that info to update the codebase accordingly. Do this on a chore branch. Once you're done, commit the changes, push, and open a PR for me to review.

Important guidelines:
- Verify each knip finding before acting. Knip can produce false positives, especially for ambient declaration files (`.d.ts`), service workers, and test infrastructure.
- For unused files: delete them only after confirming no runtime or ambient usage exists.
- For unused exports: if the symbol is still used internally in the same file, just remove the `export` keyword instead of deleting the code.
- For unused dependencies: remove them via `npm uninstall`.
- Run `npx tsc --noEmit` and `npm run test:run` to verify nothing is broken before committing.
