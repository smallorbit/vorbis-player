import { test, expect } from '@playwright/test';

/**
 * The cold-start path. Every other spec loads through `fixtures/auth-state`,
 * which stamps `vorbis-player-welcome-seen` before the app mounts — so the
 * first screen a new user actually sees was never asserted. This spec uses the
 * bare Playwright fixture so the welcome screen renders for real.
 */

const WELCOME = { name: 'Welcome to Vorbis Player' };

test.describe('First run — welcome screen', () => {
  test('a cold start lands on the welcome screen with provider status', async ({ page }) => {
    // #given / #when - a browser that has never seen the app
    await page.goto('/');

    // #then - the welcome screen renders, listing the connected mock providers
    const welcome = page.getByRole('region', WELCOME);
    await expect(welcome).toBeVisible({ timeout: 30_000 });
    await expect(welcome.getByText('Music sources')).toBeVisible();
    await expect(welcome.getByText('Connected').first()).toBeVisible();
  });

  test('the primary CTA enters the library', async ({ page }) => {
    // #given - the welcome screen on a cold start
    await page.goto('/');
    const cta = page.getByRole('button', { name: 'Browse your library' });
    await expect(cta).toBeVisible({ timeout: 30_000 });

    // #when - the user takes the primary action
    await cta.click();

    // #then - the library replaces the welcome screen
    await expect(page.locator('[data-testid="library-home"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', WELCOME)).toHaveCount(0);
  });

  test('dismissing it persists across a reload', async ({ page }) => {
    // #given - the welcome screen on a cold start
    await page.goto('/');
    const dismiss = page.getByRole('button', { name: "Don't show this again" });
    await expect(dismiss).toBeVisible({ timeout: 30_000 });

    // #when - the user dismisses it and comes back later
    await dismiss.click();
    await expect(page.getByRole('region', WELCOME)).toHaveCount(0, { timeout: 10_000 });
    await page.reload();

    // #then - the welcome screen stays gone; the app opens straight into the library
    await expect(page.locator('[data-testid="library-home"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('region', WELCOME)).toHaveCount(0);
  });
});
