import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('shouldUseMockProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns true when VITE_MOCK_PROVIDER env var is "true"', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', 'true');
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(true);
  });

  it('returns false when VITE_MOCK_PROVIDER env var is not set', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', '');
    // window.location.href is 'http://127.0.0.1:3000' (no provider param) from setup.ts
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(false);
  });

  it('returns false when VITE_MOCK_PROVIDER is "false"', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', 'false');
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(false);
  });

  it('returns true when URL has ?provider=mock', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', '');
    Object.defineProperty(window, 'location', {
      value: { href: 'http://127.0.0.1:3000/?provider=mock' },
      writable: true,
    });
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(true);
  });

  it('returns false when URL has ?provider=something-else', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', '');
    Object.defineProperty(window, 'location', {
      value: { href: 'http://127.0.0.1:3000/?provider=spotify' },
      writable: true,
    });
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(false);
  });

  it('env var takes precedence when both are set', async () => {
    vi.stubEnv('VITE_MOCK_PROVIDER', 'true');
    Object.defineProperty(window, 'location', {
      value: { href: 'http://127.0.0.1:3000/' },
      writable: true,
    });
    const { shouldUseMockProvider } = await import('../shouldUseMockProvider');
    expect(shouldUseMockProvider()).toBe(true);
  });
});
