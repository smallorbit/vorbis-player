import { configureAxe } from 'vitest-axe';
import { expect } from 'vitest';

/**
 * jsdom has no layout or canvas, so axe cannot compute rendered colors —
 * contrast is covered by the Playwright axe scans and colorUtils tests instead.
 */
const axe = configureAxe({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: { 'color-contrast': { enabled: false } },
});

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe(container);
  const summary = violations.map((v) => ({
    rule: v.id,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }));
  expect(summary, 'axe WCAG 2.1 AA violations').toEqual([]);
}
