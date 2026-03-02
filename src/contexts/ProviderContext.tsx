/**
 * ProviderContext — exposes the active music provider and registry to the app.
 *
 * Active provider is persisted to localStorage so it survives reloads.
 * Default is 'spotify' if no valid provider is stored.
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

// Ensure providers are registered before the context is used
import '@/providers/spotify/spotifyProvider';
import '@/providers/dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set

const ACTIVE_PROVIDER_KEY = 'vorbis-player-active-provider';
const DEFAULT_PROVIDER: ProviderId = 'spotify';

interface ProviderContextValue {
  /** Currently active provider id. */
  activeProviderId: ProviderId;
  /** Descriptor for the active provider (undefined if not registered). */
  activeDescriptor: ProviderDescriptor | undefined;
  /** Switch active provider. */
  setActiveProviderId: (id: ProviderId) => void;
  /** The global provider registry. */
  registry: ProviderRegistry;
}

const ProviderContext = createContext<ProviderContextValue | null>(null);

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [activeProviderId, setActiveProviderIdRaw] = useLocalStorage<ProviderId>(
    ACTIVE_PROVIDER_KEY,
    DEFAULT_PROVIDER,
  );

  // Validate: if stored value isn't a registered provider, fall back to default
  const validProviderId = providerRegistry.has(activeProviderId)
    ? activeProviderId
    : DEFAULT_PROVIDER;

  const activeDescriptor = providerRegistry.get(validProviderId);

  const setActiveProviderId = useCallback(
    (id: ProviderId) => {
      if (providerRegistry.has(id) && id !== validProviderId) {
        // Stop playback on the outgoing provider before switching
        activeDescriptor?.playback.pause().catch(() => {});
        setActiveProviderIdRaw(id);
      }
    },
    [setActiveProviderIdRaw, validProviderId, activeDescriptor],
  );

  const value = useMemo<ProviderContextValue>(
    () => ({
      activeProviderId: validProviderId,
      activeDescriptor,
      setActiveProviderId,
      registry: providerRegistry,
    }),
    [validProviderId, activeDescriptor, setActiveProviderId],
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
