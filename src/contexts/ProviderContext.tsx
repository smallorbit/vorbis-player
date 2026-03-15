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
const ENABLED_PROVIDERS_KEY = 'vorbis-player-enabled-providers';

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

  // ── Multi-provider toggle ──────────────────────────────────────────────
  /** Set of provider IDs that are currently enabled (toggled on). */
  enabledProviderIds: ProviderId[];
  /** Toggle a provider on/off. Will not disable the last remaining provider. */
  toggleProvider: (id: ProviderId) => void;
  /** Check if a specific provider is enabled. */
  isProviderEnabled: (id: ProviderId) => boolean;
  /** True when more than one provider is registered (multi-provider available). */
  hasMultipleProviders: boolean;
  /** Get descriptor for a specific provider by ID. */
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined;
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

  const allProviders = providerRegistry.getAll();
  const allProviderIds = useMemo(() => allProviders.map(p => p.id), [allProviders]);

  // ── Enabled providers (multi-toggle) ───────────────────────────────────
  const [storedEnabledIds, setStoredEnabledIds] = useLocalStorage<ProviderId[]>(
    ENABLED_PROVIDERS_KEY,
    [],
  );

  // Validate stored enabled IDs — only keep those that are actually registered.
  // If nothing is stored yet, default to all registered providers.
  const enabledProviderIds = useMemo(() => {
    const valid = storedEnabledIds.filter(id => providerRegistry.has(id));
    if (valid.length > 0) return valid;
    // Default: enable all registered providers
    return allProviderIds;
  }, [storedEnabledIds, allProviderIds]);

  const toggleProvider = useCallback(
    (id: ProviderId) => {
      if (!providerRegistry.has(id)) return;
      setStoredEnabledIds(prev => {
        const validPrev = prev.filter(pid => providerRegistry.has(pid));
        const current = validPrev.length > 0 ? validPrev : allProviderIds;
        const isCurrentlyEnabled = current.includes(id);
        if (isCurrentlyEnabled) {
          // Don't disable the last remaining provider
          if (current.length <= 1) return current;
          return current.filter(pid => pid !== id);
        } else {
          return [...current, id];
        }
      });
    },
    [setStoredEnabledIds, allProviderIds],
  );

  const isProviderEnabled = useCallback(
    (id: ProviderId) => enabledProviderIds.includes(id),
    [enabledProviderIds],
  );

  const getDescriptor = useCallback(
    (id: ProviderId) => providerRegistry.get(id),
    [],
  );

  // ── Active provider (for playback) ─────────────────────────────────────
  const needsProviderSelection =
    storedProviderId === null || !providerRegistry.has(storedProviderId);

  const validProviderId: ProviderId =
    storedProviderId !== null && providerRegistry.has(storedProviderId)
      ? storedProviderId
      : (providerRegistry.getAll()[0]?.id ?? 'spotify');

  const activeDescriptor = providerRegistry.get(validProviderId);

  const setProviderSwitchInterceptor = useCallback(
    (fn: ProviderSwitchInterceptor | null) => {
      interceptorRef.current = fn;
    },
    [],
  );

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

  const value = useMemo<ProviderContextValue>(
    () => ({
      chosenProviderId: storedProviderId,
      activeProviderId: validProviderId,
      activeDescriptor,
      setActiveProviderId,
      setProviderSwitchInterceptor,
      registry: providerRegistry,
      needsProviderSelection,
      enabledProviderIds,
      toggleProvider,
      isProviderEnabled,
      hasMultipleProviders: allProviders.length >= 2,
      getDescriptor,
    }),
    [storedProviderId, validProviderId, activeDescriptor, setActiveProviderId, setProviderSwitchInterceptor, needsProviderSelection, enabledProviderIds, toggleProvider, isProviderEnabled, allProviders.length, getDescriptor],
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
