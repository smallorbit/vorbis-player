import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

// Ensure providers are registered before the context is used
import '@/providers/spotify/spotifyProvider';
import '@/providers/dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set
import { AUTH_STATE_CHANGED_EVENT } from '@/hooks/usePopupAuth';
import { DROPBOX_AUTH_ERROR_EVENT } from '@/providers/dropbox/dropboxAuthAdapter';

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

  // ── Connected state ────────────────────────────────────────────────────
  /** Subset of enabledProviderIds whose auth.isAuthenticated() returns true. */
  connectedProviderIds: ProviderId[];
  /** Auto-fallthrough notification message, or null. Auto-clears after 5s. */
  fallthroughNotification: string | null;
  /** Dismiss the fallthrough notification. */
  dismissFallthroughNotification: () => void;
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

  // ── Popup auth revision counter ─────────────────────────────────────────
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const bumpRevision = () => setAuthRevision((prev) => prev + 1);

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, bumpRevision);
    window.addEventListener(DROPBOX_AUTH_ERROR_EVENT, bumpRevision);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'vorbis-auth-complete') return;
      bumpRevision();
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, bumpRevision);
      window.removeEventListener(DROPBOX_AUTH_ERROR_EVENT, bumpRevision);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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

  // ── Connected providers (derived from enabled + auth state) ────────────
  const connectedProviderIds = useMemo(
    () => enabledProviderIds.filter(id => providerRegistry.get(id)?.auth.isAuthenticated()),
    // authRevision triggers re-evaluation when a popup completes OAuth
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabledProviderIds, authRevision],
  );

  // ── Auto-fallthrough notification ─────────────────────────────────────
  const [fallthroughNotification, setFallthroughNotification] = useState<string | null>(null);
  const dismissFallthroughNotification = useCallback(() => setFallthroughNotification(null), []);

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

  // ── Auto-fallthrough: when active provider loses auth, switch to another ──
  useEffect(() => {
    // Only act when we have a chosen provider that's lost auth
    if (storedProviderId === null) return;
    if (activeDescriptor?.auth.isAuthenticated()) return;

    // Find the first enabled provider that's still authenticated
    const fallback = enabledProviderIds.find(
      id => id !== validProviderId && providerRegistry.get(id)?.auth.isAuthenticated(),
    );
    if (!fallback) return;

    const fallbackDesc = providerRegistry.get(fallback);
    if (!fallbackDesc) return;

    // Switch to the fallback provider
    activeDescriptor?.playback.pause().catch(() => {});
    setStoredProviderId(fallback);

    // Notify the user
    const expiredName = activeDescriptor?.name ?? storedProviderId;
    setFallthroughNotification(
      `${expiredName} session expired — switched to ${fallbackDesc.name}. Reconnect in Settings.`,
    );
  }, [storedProviderId, activeDescriptor, enabledProviderIds, validProviderId, setStoredProviderId]);

  // Auto-dismiss fallthrough notification after 5 seconds
  useEffect(() => {
    if (!fallthroughNotification) return;
    const timer = setTimeout(() => setFallthroughNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [fallthroughNotification]);

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
      connectedProviderIds,
      fallthroughNotification,
      dismissFallthroughNotification,
    }),
    // authRevision triggers re-evaluation when a popup completes OAuth
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedProviderId, validProviderId, activeDescriptor, setActiveProviderId, setProviderSwitchInterceptor, needsProviderSelection, enabledProviderIds, toggleProvider, isProviderEnabled, allProviders.length, getDescriptor, connectedProviderIds, fallthroughNotification, dismissFallthroughNotification, authRevision],
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
