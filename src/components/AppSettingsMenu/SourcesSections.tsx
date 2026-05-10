import { memo, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useProviderContext } from '@/contexts/ProviderContext';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { AUTH_COMPLETE_EVENT } from '@/constants/events';
import type { ProviderId } from '@/types/domain';
import ProviderDisconnectDialog from '@/components/ProviderDisconnectDialog';

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
import { Switch } from '@/components/ui/switch';

export const MusicSourcesSection = memo(() => {
  const { registry, enabledProviderIds, toggleProvider } = useProviderContext();
  const { tracks, setTracks, setOriginalTracks } = useTrackListContext();
  const { currentTrackIndex, setCurrentTrackIndex } = useCurrentTrackContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  const [disconnectDialogProviderId, setDisconnectDialogProviderId] = useState<ProviderId | null>(null);
  const pendingPopup = useRef<{ providerId: ProviderId; popup: Window; onSuccess: (id: ProviderId) => void } | null>(null);
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

      const { providerId, onSuccess } = pending;
      clearPendingPopup();
      onSuccess(providerId);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearPendingPopup]);

  const openLoginPopup = useCallback(
    (
      descriptor: ReturnType<typeof registry.getAll>[number],
      onSuccess: (providerId: ProviderId) => void,
    ) => {
      const providerId = descriptor.id;
      const providerName = descriptor.name;

      const originalOpen = window.open.bind(window);
      window.open = (...args: Parameters<typeof window.open>) => {
        window.open = originalOpen;
        const win = originalOpen(...args);
        if (!win) {
          toast(`Couldn't connect to ${providerName}. Try again.`);
          return win;
        }

        pendingPopup.current = { providerId, popup: win, onSuccess };
        popupPollInterval.current = setInterval(() => {
          if (!pendingPopup.current) return;
          if (pendingPopup.current.popup.closed) {
            const pending = pendingPopup.current;
            clearPendingPopup();
            const desc = registry.get(pending.providerId);
            if (!desc?.auth.isAuthenticated()) {
              const name = registry.get(pending.providerId)?.name ?? pending.providerId;
              toast(`Couldn't connect to ${name}. Try again.`);
            } else {
              onSuccess(pending.providerId);
            }
          }
        }, 500);

        return win;
      };

      descriptor.auth.beginLogin({ popup: true }).catch(() => {
        window.open = originalOpen;
        clearPendingPopup();
        toast(`Couldn't connect to ${providerName}. Try again.`);
      });
    },
    [registry, clearPendingPopup],
  );

  const handleToggleOn = useCallback(
    (descriptor: ReturnType<typeof registry.getAll>[number]) => {
      if (descriptor.auth.isAuthenticated()) {
        toggleProvider(descriptor.id);
        return;
      }

      openLoginPopup(descriptor, (providerId) => toggleProvider(providerId));
    },
    [openLoginPopup, toggleProvider],
  );

  const handleReconnect = useCallback(
    (descriptor: ReturnType<typeof registry.getAll>[number]) => {
      openLoginPopup(descriptor, () => {
        // Provider is already in enabledProviderIds — no toggleProvider call needed.
      });
    },
    [openLoginPopup],
  );

  useEffect(() => () => clearPendingPopup(), [clearPendingPopup]);

  const handleConfirmDisconnect = useCallback(() => {
    const id = disconnectDialogProviderId;
    if (!id) return;

    setDisconnectDialogProviderId(null);

    const descriptor = registry.get(id);
    descriptor?.playback.pause().catch(() => {});

    const providerTracks = tracks.filter(t => t.provider === id);
    const providerTrackIds = new Set(providerTracks.map(t => t.id));
    const remainingTracks = tracks.filter(t => t.provider !== id);

    if (remainingTracks.length === 0) {
      setTracks([]);
      setOriginalTracks([]);
      setCurrentTrackIndex(0);
    } else {
      const playingTrack = tracks[currentTrackIndex];
      const removedBeforeCurrent = tracks
        .slice(0, currentTrackIndex)
        .filter(t => providerTrackIds.has(t.id)).length;
      const newIndex = Math.max(
        0,
        Math.min(currentTrackIndex - removedBeforeCurrent, remainingTracks.length - 1),
      );
      setTracks(remainingTracks);
      setOriginalTracks(prev => prev.filter(t => t.provider !== id));
      if (playingTrack && providerTrackIds.has(playingTrack.id)) {
        setCurrentTrackIndex(0);
      } else {
        setCurrentTrackIndex(newIndex);
      }
    }

    descriptor?.auth.logout();
    toggleProvider(id);
  }, [
    disconnectDialogProviderId,
    registry,
    tracks,
    currentTrackIndex,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    toggleProvider,
  ]);

  if (providers.length < 2) return null;

  const disconnectDescriptor = disconnectDialogProviderId
    ? registry.get(disconnectDialogProviderId)
    : null;
  const affectedQueueCount = disconnectDialogProviderId
    ? tracks.filter(t => t.provider === disconnectDialogProviderId).length
    : 0;

  return (
    <FilterSection>
      <SectionTitle>Music Sources</SectionTitle>
      <FilterGrid>
        {providers.map((descriptor) => {
          const isEnabled = enabledProviderIds.includes(descriptor.id);
          const isConnected = descriptor.auth.isAuthenticated();
          const needsReconnect = isEnabled && !isConnected;
          const isLastEnabled = enabledProviderIds.length <= 1 && isEnabled;
          const status = isEnabled && isConnected ? 'connected' : needsReconnect ? 'reconnect' : 'disabled';
          return (
            <ProviderRow key={descriptor.id}>
              <ProviderName>{descriptor.name}</ProviderName>
              <ProviderStatusBadge $status={status}>
                {status === 'connected' ? 'Connected' : status === 'reconnect' ? 'Reconnect needed' : ''}
              </ProviderStatusBadge>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => {
                  if (!isEnabled) {
                    handleToggleOn(descriptor);
                  } else if (needsReconnect) {
                    handleReconnect(descriptor);
                  } else {
                    setDisconnectDialogProviderId(descriptor.id);
                  }
                }}
                aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${descriptor.name}`}
                disabled={isLastEnabled}
                variant="neutral"
              />
            </ProviderRow>
          );
        })}
      </FilterGrid>
      {disconnectDescriptor && (
        <ProviderDisconnectDialog
          providerName={disconnectDescriptor.name}
          affectedQueueCount={affectedQueueCount}
          onConfirm={handleConfirmDisconnect}
          onCancel={() => setDisconnectDialogProviderId(null)}
        />
      )}
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
          checked={syncEnabled}
          onCheckedChange={() => setSyncEnabled(!syncEnabled)}
          aria-label={`Keep ${providerName} queue synced with Vorbis playback`}
          variant="neutral"
        />
      </ControlGroup>
      {syncEnabled && hasOtherProvider && (
        <ControlGroup>
          <ControlLabel>Replace non-{providerName} tracks with {providerName} equivalents in queue</ControlLabel>
          <Switch
            checked={resolveEnabled}
            onCheckedChange={() => setResolveEnabled(!resolveEnabled)}
            aria-label={`Replace non-${providerName} tracks with ${providerName} equivalents in queue`}
            variant="neutral"
          />
        </ControlGroup>
      )}
    </FilterSection>
  );
});
NativeQueueSyncSection.displayName = 'NativeQueueSyncSection';
