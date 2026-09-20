import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { PROVIDER_RECONNECTED_EVENT, AUTH_STATE_CHANGED_EVENT, SESSION_EXPIRED_EVENT, PROVIDER_DISCONNECTED_EVENT, PROVIDER_SESSION_FALLTHROUGH_EVENT, dispatchAppEvent, onAppEvent } from '@/constants/events';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
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
        dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'spotify' });
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
        dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'spotify' });
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
        dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'spotify' });
      });

      // #then — Spotify is removed even though it was the last enabled provider
      expect(result.current.enabledProviderIds).toEqual([]);
    });

    it('emits PROVIDER_DISCONNECTED_EVENT for the UI toast layer', () => {
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

      const disconnected: Array<{ providerId: string; providerName: string }> = [];
      const unsub = onAppEvent(PROVIDER_DISCONNECTED_EVENT, (detail) => {
        disconnected.push(detail);
      });
      renderHook(() => useProviderContext(), { wrapper });

      // #when
      act(() => {
        dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'spotify' });
      });

      // #then — toast copy is owned by the UI; context only emits structured detail
      expect(disconnected).toEqual([{ providerId: 'spotify', providerName: 'Spotify' }]);
      unsub();
    });
  });

  describe('auto-fallthrough', () => {
    it('switches to an authenticated fallback and emits PROVIDER_SESSION_FALLTHROUGH_EVENT when the active provider silently loses auth', () => {
      // #given — Spotify is active+enabled but will lose auth without SESSION_EXPIRED_EVENT;
      // Dropbox stays enabled and authenticated as the fallthrough target.
      const spotify = registerProvider({
        id: 'spotify',
        name: 'Spotify',
        auth: {
          ...makeProviderDescriptor().auth,
          isAuthenticated: vi.fn().mockReturnValue(true),
        },
        playback: {
          ...makeProviderDescriptor().playback,
          pause: vi.fn().mockResolvedValue(undefined),
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
        [STORAGE_KEYS.ACTIVE_PROVIDER]: JSON.stringify('spotify'),
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify', 'dropbox']),
      });

      const fallthrough: Array<{
        expiredProviderId: ProviderId;
        expiredProviderName: string;
        fallbackProviderId: ProviderId;
        fallbackProviderName: string;
      }> = [];
      const unsub = onAppEvent(PROVIDER_SESSION_FALLTHROUGH_EVENT, (detail) => {
        fallthrough.push(detail);
      });

      const { result } = renderHook(() => useProviderContext(), { wrapper });
      expect(result.current.activeProviderId).toBe('spotify');
      expect(result.current.enabledProviderIds).toEqual(['spotify', 'dropbox']);

      // #when — active provider silently loses auth (no SESSION_EXPIRED_EVENT)
      act(() => {
        spotify.auth.isAuthenticated = vi.fn().mockReturnValue(false);
        dispatchAppEvent(AUTH_STATE_CHANGED_EVENT);
      });

      // #then — switches to Dropbox, drops Spotify from enabled, emits fallthrough detail
      expect(result.current.activeProviderId).toBe('dropbox');
      expect(result.current.enabledProviderIds).toEqual(['dropbox']);
      expect(fallthrough).toEqual([
        {
          expiredProviderId: 'spotify',
          expiredProviderName: 'Spotify',
          fallbackProviderId: 'dropbox',
          fallbackProviderName: 'Dropbox',
        },
      ]);
      unsub();
    });
  });

  describe('PROVIDER_RECONNECTED_EVENT dispatch', () => {
    function collectReconnects(): {
      events: Array<{ providerId: ProviderId }>;
      detach: () => void;
    } {
      const events: Array<{ providerId: ProviderId }> = [];
      const detach = onAppEvent(PROVIDER_RECONNECTED_EVENT, (detail) => {
        events.push(detail);
      });
      return {
        events,
        detach,
      };
    }

    it('does NOT dispatch PROVIDER_RECONNECTED_EVENT on initial mount for already-authenticated providers', () => {
      // #given — dropbox is already authenticated at mount
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
      const { events, detach } = collectReconnects();

      // #when — mount
      renderHook(() => useProviderContext(), { wrapper });

      // #then — the initial-render snapshot was seeded into previousConnectedRef
      // so dropbox (already authed) is NOT reported as a transition.
      expect(events).toEqual([]);
      detach();
    });

    it('dispatches PROVIDER_RECONNECTED_EVENT exactly once when a provider transitions to authenticated', () => {
      // #given — spotify starts unauthenticated, dropbox is already authed
      const spotify = registerProvider({
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
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify', 'dropbox']),
      });
      const { events, detach } = collectReconnects();
      renderHook(() => useProviderContext(), { wrapper });

      // #when — spotify auth flips to true, then AUTH_STATE_CHANGED_EVENT fires
      // (production flow: AUTH_STATE_CHANGED_EVENT fires after a successful OAuth
      // popup, which bumps authRevision and recomputes connectedProviderIds).
      act(() => {
        spotify.auth.isAuthenticated = vi.fn().mockReturnValue(true);
        dispatchAppEvent(AUTH_STATE_CHANGED_EVENT);
      });

      // #then — exactly one event for the newly-connected provider
      expect(events).toEqual([{ providerId: 'spotify' }]);
      detach();
    });

    it('does NOT re-dispatch on subsequent renders if no new provider is newly connected', () => {
      // #given — spotify already transitioned once
      const spotify = registerProvider({
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
        [STORAGE_KEYS.ENABLED_PROVIDERS]: JSON.stringify(['spotify', 'dropbox']),
      });
      const { events, detach } = collectReconnects();
      renderHook(() => useProviderContext(), { wrapper });

      act(() => {
        spotify.auth.isAuthenticated = vi.fn().mockReturnValue(true);
        dispatchAppEvent(AUTH_STATE_CHANGED_EVENT);
      });
      expect(events).toHaveLength(1);

      // #when — another auth-state change fires but no provider newly connects
      act(() => {
        dispatchAppEvent(AUTH_STATE_CHANGED_EVENT);
      });

      // #then — no additional dispatches
      expect(events).toHaveLength(1);
      detach();
    });
  });
});
