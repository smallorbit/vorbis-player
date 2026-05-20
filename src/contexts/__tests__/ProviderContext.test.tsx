import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { SESSION_EXPIRED_EVENT } from '@/constants/events';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ProviderDescriptor } from '@/types/providers';
import { makeProviderDescriptor } from '@/test/fixtures';

vi.mock('@/providers/spotify/spotifyProvider', () => ({}));
vi.mock('@/providers/dropbox/dropboxProvider', () => ({}));

import { providerRegistry } from '@/providers/registry';
import { ProviderProvider, useProviderContext } from '@/contexts/ProviderContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ProviderProvider>{children}</ProviderProvider>;
}

function registerProvider(overrides: Partial<ProviderDescriptor>): ProviderDescriptor {
  const descriptor = makeProviderDescriptor(overrides);
  providerRegistry.register(descriptor);
  return descriptor;
}

function resetRegistry() {
  for (const descriptor of providerRegistry.getAll()) {
    (providerRegistry as unknown as { providers: Map<string, ProviderDescriptor> }).providers.delete(
      descriptor.id,
    );
  }
}

function stubLocalStorage(entries: Record<string, string>): void {
  const store: Record<string, string> = { ...entries };
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) =>
    Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
  );
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => {
    delete store[key];
  });
}

describe('ProviderContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRegistry();
  });

  describe('SESSION_EXPIRED_EVENT', () => {
    it('removes the provider from enabledProviderIds when its session expires', () => {
      // #given — Spotify + Dropbox are both registered and enabled
      const spotify = registerProvider({
        id: 'spotify',
        name: 'Spotify',
        auth: {
          ...makeProviderDescriptor().auth,
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      registerProvider({
        id: 'dropbox' as ProviderDescriptor['id'],
        name: 'Dropbox',
        auth: {
          ...makeProviderDescriptor().auth,
          providerId: 'dropbox' as ProviderDescriptor['id'],
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      stubLocalStorage({
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify', 'dropbox']),
      });

      const { result } = renderHook(() => useProviderContext(), { wrapper });
      expect(result.current.enabledProviderIds).toEqual(['spotify', 'dropbox']);

      // #when — Spotify's session is reported as expired
      act(() => {
        spotify.auth.isAuthenticated = vi.fn().mockReturnValue(false);
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId: 'spotify' } }),
        );
      });

      // #then — Spotify is removed from the enabled set; Dropbox stays
      expect(result.current.enabledProviderIds).toEqual(['dropbox']);
    });

    it('does not toggle a provider that is already disabled', () => {
      // #given — Spotify is registered but disabled; only Dropbox is enabled
      registerProvider({
        id: 'spotify',
        name: 'Spotify',
        auth: {
          ...makeProviderDescriptor().auth,
          isAuthenticated: vi.fn().mockReturnValue(false),
        },
      });
      registerProvider({
        id: 'dropbox' as ProviderDescriptor['id'],
        name: 'Dropbox',
        auth: {
          ...makeProviderDescriptor().auth,
          providerId: 'dropbox' as ProviderDescriptor['id'],
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      stubLocalStorage({
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['dropbox']),
      });

      const { result } = renderHook(() => useProviderContext(), { wrapper });
      expect(result.current.enabledProviderIds).toEqual(['dropbox']);

      // #when — a stray SESSION_EXPIRED for the already-disabled Spotify fires
      act(() => {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId: 'spotify' } }),
        );
      });

      // #then — Dropbox is not re-toggled and remains the sole enabled provider
      expect(result.current.enabledProviderIds).toEqual(['dropbox']);
    });

    it('removes the sole enabled provider on session expiry, bypassing the "last enabled" guard', () => {
      // #given — only Spotify is enabled (Dropbox registered but disabled)
      const spotify = registerProvider({
        id: 'spotify',
        name: 'Spotify',
        auth: {
          ...makeProviderDescriptor().auth,
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      registerProvider({
        id: 'dropbox' as ProviderDescriptor['id'],
        name: 'Dropbox',
        auth: {
          ...makeProviderDescriptor().auth,
          providerId: 'dropbox' as ProviderDescriptor['id'],
          isAuthenticated: vi.fn().mockReturnValue(false),
        },
      });
      stubLocalStorage({
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify']),
      });

      const { result } = renderHook(() => useProviderContext(), { wrapper });
      expect(result.current.enabledProviderIds).toEqual(['spotify']);

      // #when — Spotify's session expires while it is the sole enabled provider
      act(() => {
        spotify.auth.isAuthenticated = vi.fn().mockReturnValue(false);
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId: 'spotify' } }),
        );
      });

      // #then — Spotify is removed even though it was the last enabled provider
      expect(result.current.enabledProviderIds).toEqual([]);
      // #then — the disconnect toast still surfaces so the user knows why
      expect(result.current.disconnectToast).toBe('Spotify disconnected — session expired.');
    });

    it('surfaces the disconnect toast', () => {
      // #given
      registerProvider({
        id: 'spotify',
        name: 'Spotify',
        auth: {
          ...makeProviderDescriptor().auth,
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      registerProvider({
        id: 'dropbox' as ProviderDescriptor['id'],
        name: 'Dropbox',
        auth: {
          ...makeProviderDescriptor().auth,
          providerId: 'dropbox' as ProviderDescriptor['id'],
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
      });
      stubLocalStorage({
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify', 'dropbox']),
      });

      const { result } = renderHook(() => useProviderContext(), { wrapper });

      // #when
      act(() => {
        window.dispatchEvent(
          new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId: 'spotify' } }),
        );
      });

      // #then
      expect(result.current.disconnectToast).toBe('Spotify disconnected — session expired.');
    });
  });
});
