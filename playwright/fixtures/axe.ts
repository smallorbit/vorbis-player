import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Scan the page (or `include` selector) against WCAG 2.1 A/AA and fail with a
 * readable list of violations. Pass `disableRules` only with a comment at the
 * call site explaining why the rule cannot apply to that surface.
 */
export async function expectNoAxeViolations(
  page: Page,
  options: { include?: string; disableRules?: string[] } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_AA_TAGS);
  if (options.include) builder = builder.include(options.include);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);

  const { violations } = await builder.analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }));
  expect(summary, 'axe WCAG 2.1 AA violations').toEqual([]);
}
