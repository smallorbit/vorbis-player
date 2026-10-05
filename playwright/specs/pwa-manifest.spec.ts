import { test, expect } from '../fixtures/auth-state';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose?: string;
}

test.describe('PWA manifest', () => {
  test('is linked, provider-neutral, and ships separate any/maskable icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href ?? '');
    expect(response.ok()).toBe(true);
    const manifest: unknown = await response.json();
    expect(manifest).toMatchObject({ start_url: '/', display: 'standalone' });
    expect(manifest).not.toHaveProperty('orientation');
    if (typeof manifest !== 'object' || manifest === null || !('icons' in manifest)) {
      throw new Error('manifest has no icons');
    }
    const icons = manifest.icons as ManifestIcon[];

    expect(icons.every((icon) => icon.purpose === 'any' || icon.purpose === 'maskable')).toBe(true);
    for (const purpose of ['any', 'maskable']) {
      expect(icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes).sort()).toEqual([
        '192x192',
        '512x512',
      ]);
    }
    for (const icon of icons) {
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }
  });
});
