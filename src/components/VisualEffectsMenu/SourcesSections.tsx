import { memo, useMemo, useCallback, useEffect, useRef, useState } from 'react';

import { useProviderContext } from '@/contexts/ProviderContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { AUTH_COMPLETE_EVENT } from '@/constants/events';
import type { ProviderId } from '@/types/domain';
import Toast from '@/components/Toast';

import {
  FilterSection,
  SectionTitle,
  ControlGroup,
  ControlLabel,
  FilterGrid,
  ProviderRow,
  ProviderName,
  ProviderStatusBadge,
} from './styled';
import Switch from '@/components/controls/Switch';

export const MusicSourcesSection = memo(() => {
  const { registry, enabledProviderIds, toggleProvider } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pendingPopup = useRef<{ providerId: ProviderId; popup: Window } | null>(null);
  const popupPollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPendingPopup = useCallback(() => {
    if (popupPollInterval.current !== null) {
      clearInterval(popupPollInterval.current);
      popupPollInterval.current = null;
    }
    pendingPopup.current = null;
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== AUTH_COMPLETE_EVENT) return;

      const pending = pendingPopup.current;
      if (!pending) return;
      if (event.data?.provider !== pending.providerId) return;

      clearPendingPopup();
      toggleProvider(pending.providerId);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toggleProvider, clearPendingPopup]);

  const handleToggleOn = useCallback(
    (descriptor: ReturnType<typeof registry.getAll>[number]) => {
      if (descriptor.auth.isAuthenticated()) {
        toggleProvider(descriptor.id);
        return;
      }

      const providerId = descriptor.id;
      const providerName = descriptor.name;

      // Intercept window.open to capture the popup reference when beginLogin opens it
      const originalOpen = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        window.open = originalOpen;
        const win = originalOpen(...args);
        if (!win) {
          setToastMessage(`Couldn't connect to ${providerName}. Try again.`);
          return win;
        }

        pendingPopup.current = { providerId, popup: win };
        popupPollInterval.current = setInterval(() => {
          if (!pendingPopup.current) return;
          if (pendingPopup.current.popup.closed) {
            const pending = pendingPopup.current;
            clearPendingPopup();
            const desc = registry.get(pending.providerId);
            if (!desc?.auth.isAuthenticated()) {
              const name = registry.get(pending.providerId)?.name ?? pending.providerId;
              setToastMessage(`Couldn't connect to ${name}. Try again.`);
            } else {
              toggleProvider(pending.providerId);
            }
          }
        }, 500);

        return win;
      };

      descriptor.auth.beginLogin({ popup: true }).catch(() => {
        window.open = originalOpen;
        clearPendingPopup();
        setToastMessage(`Couldn't connect to ${providerName}. Try again.`);
      });
    },
    [registry, toggleProvider, clearPendingPopup],
  );

  useEffect(() => () => clearPendingPopup(), [clearPendingPopup]);

  if (providers.length < 2) return null;

  return (
    <FilterSection>
      <SectionTitle>Music Sources</SectionTitle>
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
      <FilterGrid>
        {providers.map((descriptor) => {
          const isEnabled = enabledProviderIds.includes(descriptor.id);
          const isConnected = descriptor.auth.isAuthenticated();
          const isLastEnabled = enabledProviderIds.length <= 1 && isEnabled;
          const status = isEnabled && isConnected ? 'connected' : 'disabled';
          return (
            <ProviderRow key={descriptor.id}>
              <ProviderName>{descriptor.name}</ProviderName>
              <ProviderStatusBadge $status={status}>
                {status === 'connected' ? 'Connected' : ''}
              </ProviderStatusBadge>
              <Switch
                on={isEnabled}
                onToggle={() => {
                  if (!isEnabled) {
                    handleToggleOn(descriptor);
                  } else {
                    toggleProvider(descriptor.id);
                  }
                }}
                ariaLabel={`${isEnabled ? 'Disable' : 'Enable'} ${descriptor.name}`}
                disabled={isLastEnabled}
                variant="neutral"
              />
            </ProviderRow>
          );
        })}
      </FilterGrid>
    </FilterSection>
  );
});
MusicSourcesSection.displayName = 'MusicSourcesSection';

export const NativeQueueSyncSection = memo(() => {
  const { connectedProviderIds, registry } = useProviderContext();

  const syncProvider = useMemo(() => {
    const allProviders = registry.getAll();
    return allProviders.find(
      (p) => p.capabilities.hasNativeQueueSync && connectedProviderIds.includes(p.id),
    );
  }, [registry, connectedProviderIds]);

  const hasOtherProvider = connectedProviderIds.length > 1;

  const [syncEnabled, setSyncEnabled] = useLocalStorage(
    STORAGE_KEYS.SPOTIFY_QUEUE_SYNC,
    true,
  );
  const [resolveEnabled, setResolveEnabled] = useLocalStorage(
    STORAGE_KEYS.SPOTIFY_QUEUE_CROSS_PROVIDER,
    true,
  );

  if (!syncProvider) return null;

  const providerName = syncProvider.name;

  return (
    <FilterSection>
      <SectionTitle>{providerName} Queue</SectionTitle>
      <ControlGroup>
        <ControlLabel>Keep {providerName} queue synced with Vorbis playback</ControlLabel>
        <Switch
          on={syncEnabled}
          onToggle={() => setSyncEnabled(!syncEnabled)}
          ariaLabel={`Keep ${providerName} queue synced with Vorbis playback`}
          variant="neutral"
        />
      </ControlGroup>
      {syncEnabled && hasOtherProvider && (
        <ControlGroup>
          <ControlLabel>Replace non-{providerName} tracks with {providerName} equivalents in queue</ControlLabel>
          <Switch
            on={resolveEnabled}
            onToggle={() => setResolveEnabled(!resolveEnabled)}
            ariaLabel={`Replace non-${providerName} tracks with ${providerName} equivalents in queue`}
            variant="neutral"
          />
        </ControlGroup>
      )}
    </FilterSection>
  );
});
NativeQueueSyncSection.displayName = 'NativeQueueSyncSection';
