import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor, ProviderRegistry } from '@/types/providers';

// Ensure real providers are registered before the context is used.
import '@/providers/registerProviders';
import {
  AUTH_STATE_CHANGED_EVENT,
  PROVIDER_DISCONNECTED_EVENT,
  PROVIDER_RECONNECTED_EVENT,
  PROVIDER_SESSION_FALLTHROUGH_EVENT,
  SESSION_EXPIRED_EVENT,
  dispatchAppEvent,
  onAppEvent,
} from '@/constants/events';
import { STORAGE_KEYS } from '@/constants/storage';
import { parseAuthCompletePostMessage } from '@/utils/authPostMessage';

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
}

type ProviderContextHmrData = {
  ProviderContext?: React.Context<ProviderContextValue | null> | undefined;
};

function readProviderContextHmrData(): ProviderContextHmrData {
  if (!import.meta.hot?.data) return {};
  return import.meta.hot.data as ProviderContextHmrData;
}

const hotProviderContext = readProviderContextHmrData().ProviderContext;
const ProviderContext: React.Context<ProviderContextValue | null> =
  hotProviderContext ?? createContext<ProviderContextValue | null>(null);
if (import.meta.hot?.data && hotProviderContext === undefined) {
  (import.meta.hot.data as ProviderContextHmrData).ProviderContext = ProviderContext;
}

/**
 * Resolve the current enabled list from the stored sentinel value.
 * `null` means "never initialized → all registered"; an explicit `[]` is honored.
 */
function resolveEnabledIds(
  stored: ProviderId[] | null,
  allProviderIds: ProviderId[],
): ProviderId[] {
  if (stored === null) return allProviderIds;
  return stored.filter(id => providerRegistry.has(id));
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

    const unsubAuthState = onAppEvent(AUTH_STATE_CHANGED_EVENT, bumpRevision);
    // Provider-specific auth events (e.g. token revocation detected mid-request)
    // come from descriptors, so any registered provider can participate.
    const providerAuthEvents = providerRegistry.getAll()
      .map((descriptor) => descriptor.authStateChangedEvent)
      .filter((eventName): eventName is string => typeof eventName === 'string');
    for (const eventName of providerAuthEvents) {
      window.addEventListener(eventName, bumpRevision);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (parseAuthCompletePostMessage(event.data) === null) return;
      bumpRevision();
    };
    window.addEventListener('message', handleMessage);

    return () => {
      unsubAuthState();
      for (const eventName of providerAuthEvents) {
        window.removeEventListener(eventName, bumpRevision);
      }
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

  const enabledProviderIds = useMemo(
    () => resolveEnabledIds(storedEnabledIds, allProviderIds),
    [storedEnabledIds, allProviderIds],
  );

  /**
   * Force-remove a provider from the enabled set, bypassing the user-facing
   * "do not disable the last remaining provider" guard. Used by the single
   * session-expiry / fallthrough path when underlying auth has failed.
   */
  const removeFromEnabled = useCallback(
    (id: ProviderId) => {
      setStoredEnabledIds(prev => {
        const current = resolveEnabledIds(prev, allProviderIds);
        if (!current.includes(id)) return current;
        return current.filter(pid => pid !== id);
      });
    },
    [setStoredEnabledIds, allProviderIds],
  );

  const toggleProvider = useCallback(
    (id: ProviderId) => {
      if (!providerRegistry.has(id)) return;
      setStoredEnabledIds(prev => {
        const current = resolveEnabledIds(prev, allProviderIds);
        const isCurrentlyEnabled = current.includes(id);
        if (isCurrentlyEnabled) {
          // Don't disable the last remaining provider via the user-facing
          // toggle. Session-expired bypasses this guard via removeFromEnabled.
          if (current.length <= 1) return current;
          return current.filter(pid => pid !== id);
        }
        return [...current, id];
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

  // ── Detect `not authenticated → authenticated` transitions ─────────────
  // The first render seeds previousConnectedRef without dispatching, so
  // providers that are already authenticated at mount are not treated as a
  // transition (the persisted-session hydrate path owns the initial primed
  // state). On subsequent renders, every provider newly present in
  // connectedProviderIds emits PROVIDER_RECONNECTED_EVENT exactly once.
  const previousConnectedRef = useRef<Set<ProviderId> | null>(null);
  useEffect(() => {
    const current = new Set(connectedProviderIds);
    const previous = previousConnectedRef.current;
    previousConnectedRef.current = current;
    if (previous === null) return;
    for (const providerId of current) {
      if (previous.has(providerId)) continue;
      dispatchAppEvent(PROVIDER_RECONNECTED_EVENT, { providerId });
    }
  }, [connectedProviderIds]);

  // Latest-value refs so the SESSION_EXPIRED_EVENT listener (attached once,
  // []-deps) can read current helpers without re-binding on every render.
  const removeFromEnabledRef = useRef(removeFromEnabled);
  const enabledProviderIdsRef = useRef(enabledProviderIds);
  useEffect(() => {
    removeFromEnabledRef.current = removeFromEnabled;
  }, [removeFromEnabled]);
  useEffect(() => {
    enabledProviderIdsRef.current = enabledProviderIds;
  }, [enabledProviderIds]);

  // ── Single session-expiry flow ─────────────────────────────────────────
  // Adapters report unrecoverable 401s via SESSION_EXPIRED_EVENT. We force the
  // provider off the enabled set and emit PROVIDER_DISCONNECTED_EVENT so the UI
  // layer can render the toast — toast copy does not live in this context.
  useEffect(() => {
    return onAppEvent(SESSION_EXPIRED_EVENT, (detail) => {
      const providerId = detail.providerId;
      if (!providerId) return;
      const descriptor = providerRegistry.get(providerId);
      const providerName = descriptor?.name ?? providerId;
      setAuthRevision(prev => prev + 1);
      if (enabledProviderIdsRef.current.includes(providerId)) {
        removeFromEnabledRef.current(providerId);
      }
      dispatchAppEvent(PROVIDER_DISCONNECTED_EVENT, { providerId, providerName });
    });
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

    const expiredId = storedProviderId;
    const expiredName = activeDescriptor?.name ?? storedProviderId;

    // Switch to the fallback provider
    activeDescriptor?.playback.pause().catch(() => {});
    setStoredProviderId(fallback);

    // Mirror session-expiry: force the expired provider off via removeFromEnabled
    // so the settings UI reflects its not-connected state.
    removeFromEnabled(expiredId);

    // UI layer owns toast copy — emit structured fallthrough detail.
    // StrictMode may double-invoke this effect when the fallthrough condition is
    // already true at mount; removeFromEnabled is idempotent, and AudioPlayer
    // toasts use a fixed id (FALLTHROUGH_TOAST_ID) so sonner de-dupes. Future
    // listeners with non-idempotent side effects must guard similarly.
    dispatchAppEvent(PROVIDER_SESSION_FALLTHROUGH_EVENT, {
      expiredProviderId: expiredId,
      expiredProviderName: expiredName,
      fallbackProviderId: fallback,
      fallbackProviderName: fallbackDesc.name,
    });
    // authRevision: re-evaluate when isAuthenticated flips without changing the
    // descriptor object identity (AUTH_STATE_CHANGED / popup / provider auth events).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedProviderId, activeDescriptor, enabledProviderIds, validProviderId, setStoredProviderId, removeFromEnabled, authRevision]);

  // ── Auto-switch when active provider is disabled ──────────────────────
  useEffect(() => {
    if (storedProviderId === null) return;
    if (enabledProviderIds.includes(storedProviderId)) return;

    const fallback = enabledProviderIds.find(id => providerRegistry.has(id));
    if (!fallback) return;

    activeDescriptor?.playback.pause().catch(() => {});
    setStoredProviderId(fallback);
  }, [storedProviderId, enabledProviderIds, activeDescriptor, setStoredProviderId]);

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
    }),
    // authRevision triggers re-evaluation when a popup completes OAuth
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedProviderId, validProviderId, activeDescriptor, setActiveProviderId, setProviderSwitchInterceptor, needsProviderSelection, enabledProviderIds, toggleProvider, isProviderEnabled, allProviders.length, getDescriptor, connectedProviderIds, authRevision],
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
