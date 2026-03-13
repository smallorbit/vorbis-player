import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ProviderProvider, useProviderContext } from '../ProviderContext';
import type { ProviderSwitchInterceptor } from '../ProviderContext';

vi.mock('@/providers/spotify/spotifyProvider', () => ({}));
vi.mock('@/providers/dropbox/dropboxProvider', () => ({}));

const mockPause = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/registry', () => {
  const registry = {
    has: vi.fn((id: string) => id === 'spotify'),
    get: vi.fn((id: string) =>
      id === 'spotify' ? { id: 'spotify', playback: { pause: mockPause } } : undefined,
    ),
    getAll: vi.fn(() => [{ id: 'spotify', playback: { pause: mockPause } }]),
    register: vi.fn(),
  };
  return { providerRegistry: registry };
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ProviderProvider>{children}</ProviderProvider>;
}

describe('ProviderContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  describe('setProviderSwitchInterceptor', () => {
    it('exposes setProviderSwitchInterceptor on the context', () => {
      const { result } = renderHook(() => useProviderContext(), { wrapper });
      expect(typeof result.current.setProviderSwitchInterceptor).toBe('function');
    });

    it('calls interceptor instead of switching when one is registered', () => {
      const { result } = renderHook(() => useProviderContext(), { wrapper });
      const interceptor = vi.fn<ProviderSwitchInterceptor>();

      act(() => {
        result.current.setProviderSwitchInterceptor(interceptor);
      });

      act(() => {
        result.current.setActiveProviderId('spotify');
      });

      expect(interceptor).toHaveBeenCalledOnce();
      expect(interceptor).toHaveBeenCalledWith('spotify', expect.any(Function), expect.any(Function));
    });

    it('proceed() callback completes the provider switch', () => {
      const { result } = renderHook(() => useProviderContext(), { wrapper });
      let capturedProceed: (() => void) | null = null;

      const interceptor: ProviderSwitchInterceptor = (_id, proceed) => {
        capturedProceed = proceed;
      };

      act(() => {
        result.current.setProviderSwitchInterceptor(interceptor);
      });

      act(() => {
        result.current.setActiveProviderId('spotify');
      });

      expect(capturedProceed).not.toBeNull();

      const setItemCallsBefore = vi.mocked(window.localStorage.setItem).mock.calls.length;

      act(() => {
        capturedProceed!();
      });

      const setItemCallsAfter = vi.mocked(window.localStorage.setItem).mock.calls.length;
      expect(setItemCallsAfter).toBeGreaterThan(setItemCallsBefore);
    });

    it('cancel() does not switch provider', () => {
      const { result } = renderHook(() => useProviderContext(), { wrapper });
      let capturedCancel: (() => void) | null = null;

      const interceptor: ProviderSwitchInterceptor = (_id, _proceed, cancel) => {
        capturedCancel = cancel;
      };

      act(() => {
        result.current.setProviderSwitchInterceptor(interceptor);
      });

      const setItemCallsBefore = vi.mocked(window.localStorage.setItem).mock.calls.length;

      act(() => {
        result.current.setActiveProviderId('spotify');
      });

      act(() => {
        capturedCancel!();
      });

      const setItemCallsAfter = vi.mocked(window.localStorage.setItem).mock.calls.length;
      expect(setItemCallsAfter).toBe(setItemCallsBefore);
    });

    it('clears interceptor when set to null and switches normally afterwards', () => {
      const { result } = renderHook(() => useProviderContext(), { wrapper });
      const interceptor = vi.fn<ProviderSwitchInterceptor>();

      act(() => {
        result.current.setProviderSwitchInterceptor(interceptor);
      });

      act(() => {
        result.current.setProviderSwitchInterceptor(null);
      });

      act(() => {
        result.current.setActiveProviderId('spotify');
      });

      expect(interceptor).not.toHaveBeenCalled();
    });
  });
});
