import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

// Ensure real providers are registered before the context is used.
// Mock provider, if active, is loaded synchronously in main.tsx before render.
import '@/providers/spotify/spotifyProvider';
import '@/providers/dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set
import { AUTH_STATE_CHANGED_EVENT } from '@/hooks/usePopupAuth';
import { DROPBOX_AUTH_ERROR_EVENT } from '@/providers/dropbox/dropboxAuthAdapter';
import { AUTH_COMPLETE_EVENT, SESSION_EXPIRED_EVENT } from '@/constants/events';
import { STORAGE_KEYS } from '@/constants/storage';
import { NOTIFICATION_DISMISS_MS } from '@/constants/timing';

type ProviderSwitchInterceptor = (
  newProviderId: ProviderId,
  proceed: () => void,
  cancel: () => void,
) => void;

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

  /** Auto-dismiss toast shown immediately when a provider is disconnected due to an unrecoverable 401. */
  disconnectToast: string | null;
  /** Dismiss the disconnect toast. */
  dismissDisconnectToast: () => void;
}

const ProviderContext =
  (import.meta.hot?.data?.ProviderContext as React.Context<ProviderContextValue | null> | undefined) ??
  createContext<ProviderContextValue | null>(null);
if (import.meta.hot?.data) {
  import.meta.hot.data.ProviderContext = ProviderContext;
}

export function ProviderProvider({ children }: { children: React.ReactNode }) {
  const [storedProviderId, setStoredProviderId] = useLocalStorage<ProviderId | null>(
    STORAGE_KEYS.ACTIVE_PROVIDER,
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
      if (event.data?.type !== AUTH_COMPLETE_EVENT) return;
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
  // Stored value uses `null` as the "uninitialized" sentinel (default to all
  // registered providers). An explicit `[]` means the user — or a forced
  // session-expired toggle-off — has emptied the set, and we must honor it
  // rather than re-defaulting.
  const [storedEnabledIds, setStoredEnabledIds] = useLocalStorage<ProviderId[] | null>(
    STORAGE_KEYS.ENABLED_PROVIDERS,
    null,
  );

  const enabledProviderIds = useMemo(() => {
    if (storedEnabledIds === null) return allProviderIds;
    return storedEnabledIds.filter(id => providerRegistry.has(id));
  }, [storedEnabledIds, allProviderIds]);

  const toggleProvider = useCallback(
    (id: ProviderId) => {
      if (!providerRegistry.has(id)) return;
      setStoredEnabledIds(prev => {
        const current =
          prev === null ? allProviderIds : prev.filter(pid => providerRegistry.has(pid));
        const isCurrentlyEnabled = current.includes(id);
        if (isCurrentlyEnabled) {
          // Don't disable the last remaining provider via the user-facing
          // toggle. Session-expired bypasses this guard by writing through
          // `setStoredEnabledIds` directly (see handleSessionExpired below).
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

  // ── Disconnect toast (auto-dismiss) ──────────────────────────────────
  const [disconnectToast, setDisconnectToast] = useState<string | null>(null);
  const dismissDisconnectToast = useCallback(() => setDisconnectToast(null), []);

  // Latest-value refs so the SESSION_EXPIRED_EVENT listener (attached once,
  // []-deps) can read the current state setters without re-binding on every
  // render. Re-binding would race user-driven toggles and risk dropping events
  // fired during a re-render.
  //
  // Session-expired uses `setStoredEnabledIds` directly instead of going
  // through `toggleProvider` so it can bypass the "do not disable the last
  // remaining provider" guard. That guard exists to prevent accidental
  // user-initiated zero-provider states; a forced session-expired toggle-off
  // must accurately reflect that the underlying auth has failed, regardless
  // of how many providers remain enabled.
  const setStoredEnabledIdsRef = useRef(setStoredEnabledIds);
  const enabledProviderIdsRef = useRef(enabledProviderIds);
  const allProviderIdsRef = useRef(allProviderIds);
  useEffect(() => {
    setStoredEnabledIdsRef.current = setStoredEnabledIds;
  }, [setStoredEnabledIds]);
  useEffect(() => {
    enabledProviderIdsRef.current = enabledProviderIds;
  }, [enabledProviderIds]);
  useEffect(() => {
    allProviderIdsRef.current = allProviderIds;
  }, [allProviderIds]);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ providerId: ProviderId }>).detail;
      const providerId = detail?.providerId;
      if (!providerId) return;
      const descriptor = providerRegistry.get(providerId);
      const name = descriptor?.name ?? providerId;
      setDisconnectToast(`${name} disconnected — session expired.`);
      setAuthRevision(prev => prev + 1);
      if (enabledProviderIdsRef.current.includes(providerId)) {
        setStoredEnabledIdsRef.current(prev => {
          const current =
            prev === null
              ? allProviderIdsRef.current
              : prev.filter(pid => providerRegistry.has(pid));
          if (!current.includes(providerId)) return current;
          return current.filter(pid => pid !== providerId);
        });
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

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

    // Toggle the expired provider off so the settings UI reflects its
    // not-connected state. Mirrors handleSessionExpired and bypasses
    // toggleProvider's "last enabled" guard by writing setStoredEnabledIds
    // directly — the underlying auth has failed and the toggle must
    // accurately reflect that regardless of how many providers remain.
    const expiredId = storedProviderId;
    setStoredEnabledIds(prev => {
      const current =
        prev === null ? allProviderIds : prev.filter(pid => providerRegistry.has(pid));
      if (!current.includes(expiredId)) return current;
      return current.filter(pid => pid !== expiredId);
    });

    // Notify the user
    const expiredName = activeDescriptor?.name ?? storedProviderId;
    setFallthroughNotification(
      `${expiredName} session expired — switched to ${fallbackDesc.name}. Re-enable in Settings.`,
    );
  }, [storedProviderId, activeDescriptor, enabledProviderIds, validProviderId, setStoredProviderId, setStoredEnabledIds, allProviderIds]);

  // ── Auto-switch when active provider is disabled ──────────────────────
  useEffect(() => {
    if (storedProviderId === null) return;
    if (enabledProviderIds.includes(storedProviderId)) return;

    const fallback = enabledProviderIds.find(id => providerRegistry.has(id));
    if (!fallback) return;

    activeDescriptor?.playback.pause().catch(() => {});
    setStoredProviderId(fallback);
  }, [storedProviderId, enabledProviderIds, activeDescriptor, setStoredProviderId]);

  // Auto-dismiss fallthrough notification after 5 seconds
  useEffect(() => {
    if (!fallthroughNotification) return;
    const timer = setTimeout(() => setFallthroughNotification(null), NOTIFICATION_DISMISS_MS);
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
      disconnectToast,
      dismissDisconnectToast,
    }),
    // authRevision triggers re-evaluation when a popup completes OAuth
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedProviderId, validProviderId, activeDescriptor, setActiveProviderId, setProviderSwitchInterceptor, needsProviderSelection, enabledProviderIds, toggleProvider, isProviderEnabled, allProviders.length, getDescriptor, connectedProviderIds, fallthroughNotification, dismissFallthroughNotification, disconnectToast, dismissDisconnectToast, authRevision],
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
