/**
 * Import layering zones for #1733 (F76). Bottom → top; each layer may import
 * only from layers below it. See CLAUDE.md and docs/architecture/layering.md.
 */

const foundation = ['./src/types/**', './src/constants/**'];
const platform = ['./src/lib/**', './src/utils/**', './src/workers/**', './src/styles/**'];
const engine = ['./src/services/**', './src/stores/**'];
const providers = ['./src/providers/**'];
const appLogic = ['./src/hooks/**', './src/contexts/**'];
const ui = ['./src/components/**', './src/App.*', './src/main.*'];

/** @param {string[]} targets @param {string[]} forbiddenFrom */
function forbid(targets, forbiddenFrom) {
  return targets.map((target) => ({ target, from: forbiddenFrom }));
}

/** @type {import('eslint-plugin-import').Rules['import/no-restricted-paths'][1]['zones']} */
export const importLayerZones = [
  ...forbid(foundation, [...platform, ...engine, ...providers, ...appLogic, ...ui]),
  ...forbid(platform, [...engine, ...providers, ...appLogic, ...ui]),
  ...forbid(engine, [...providers, ...appLogic, ...ui]),
  ...forbid(providers, [...appLogic, ...ui]),
  ...forbid(appLogic, ui),
];
