import React, { createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

// Ensure providers are registered before the context is used
import '@/providers/spotify/spotifyProvider';
import '@/providers/dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set

export type ProviderSwitchInterceptor = (
  newProviderId: ProviderId,
  proceed: () => void,
  cancel: () => void,
) => void;

const ACTIVE_PROVIDER_KEY = 'vorbis-player-active-provider';

interface ProviderContextValue {
  /** Raw stored value — null means never chosen (show picker). */
  chosenProviderId: ProviderId | null;
  /** Validated, non-null provider id for hooks that always need one. Falls back to first registered. */
  activeProviderId: ProviderId;
  /** Descriptor for the active provider (undefined if not registered). */
  activeDescriptor: ProviderDescriptor | undefined;
  /** Switch active provider. Pass null to reset to the provider picker. */
  setActiveProviderId: (id: ProviderId | null) => void;
  /** Register a function that can intercept and optionally block provider switches. */
  setProviderSwitchInterceptor: (interceptor: ProviderSwitchInterceptor | null) => void;
  /** The global provider registry. */
  registry: ProviderRegistry;
  /** True when no provider has been chosen or the stored one is no longer registered. */
  needsProviderSelection: boolean;
}

const ProviderContext =
  (import.meta.hot?.data?.ProviderContext as React.Context<ProviderContextValue | null> | undefined) ??
  createContext<ProviderContextValue | null>(null);
if (import.meta.hot?.data) {
  import.meta.hot.data.ProviderContext = ProviderContext;
}

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [storedProviderId, setStoredProviderId] = useLocalStorage<ProviderId | null>(
    ACTIVE_PROVIDER_KEY,
    null,
  );

  const interceptorRef = useRef<ProviderSwitchInterceptor | null>(null);

  const needsProviderSelection =
    storedProviderId === null || !providerRegistry.has(storedProviderId);

  const validProviderId: ProviderId =
    storedProviderId !== null && providerRegistry.has(storedProviderId)
      ? storedProviderId
      : (providerRegistry.getAll()[0]?.id ?? 'spotify');

  const activeDescriptor = providerRegistry.get(validProviderId);

  const setActiveProviderId = useCallback(
    (id: ProviderId | null) => {
      const doSwitch = () => {
        if (id === null) {
          activeDescriptor?.playback.pause().catch(() => {});
          setStoredProviderId(null);
        } else if (providerRegistry.has(id) && id !== storedProviderId) {
          activeDescriptor?.playback.pause().catch(() => {});
          setStoredProviderId(id);
        }
      };

      if (id !== null && interceptorRef.current) {
        interceptorRef.current(id, doSwitch, () => {});
        return;
      }

      doSwitch();
    },
    [setStoredProviderId, storedProviderId, activeDescriptor],
  );

  const setProviderSwitchInterceptor = useCallback(
    (fn: ProviderSwitchInterceptor | null) => {
      interceptorRef.current = fn;
    },
    [],
  );

  const value = useMemo<ProviderContextValue>(
    () => ({
      chosenProviderId: storedProviderId,
      activeProviderId: validProviderId,
      activeDescriptor,
      setActiveProviderId,
      setProviderSwitchInterceptor,
      registry: providerRegistry,
      needsProviderSelection,
    }),
    [storedProviderId, validProviderId, activeDescriptor, setActiveProviderId, setProviderSwitchInterceptor, needsProviderSelection],
  );

  return (
    <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>
  );
}

export function useProviderContext(): ProviderContextValue {
  const ctx = useContext(ProviderContext);
  if (!ctx) {
    throw new Error('useProviderContext must be used within ProviderProvider');
  }
  return ctx;
}
