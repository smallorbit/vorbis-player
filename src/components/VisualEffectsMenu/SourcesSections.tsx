import { memo, useMemo } from 'react';

import { useProviderContext } from '@/contexts/ProviderContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

import {
  FilterSection,
  SectionTitle,
  ControlGroup,
  ControlLabel,
  FilterGrid,
  ProviderRow,
  ProviderName,
  ProviderStatusBadge,
  ProviderConnectAction,
} from './styled';
import Switch from '@/components/controls/Switch';

export const MusicSourcesSection = memo(() => {
  const { registry, enabledProviderIds, toggleProvider } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  if (providers.length < 2) return null;

  return (
    <FilterSection>
      <SectionTitle>Music Sources</SectionTitle>
      <FilterGrid>
        {providers.map((descriptor) => {
          const isEnabled = enabledProviderIds.includes(descriptor.id);
          const isConnected = descriptor.auth.isAuthenticated();
          const isLastEnabled = enabledProviderIds.length <= 1 && isEnabled;
          const status = !isEnabled ? 'disabled' : isConnected ? 'connected' : 'expired';
          return (
            <ProviderRow key={descriptor.id}>
              <ProviderName>{descriptor.name}</ProviderName>
              <ProviderStatusBadge $status={status}>
                {status === 'connected' ? 'Connected' : status === 'expired' ? 'Expired' : ''}
              </ProviderStatusBadge>
              {isEnabled && !isConnected && (
                <ProviderConnectAction onClick={() => descriptor.auth.beginLogin({ popup: true })}>
                  Reconnect
                </ProviderConnectAction>
              )}
              <Switch
                on={isEnabled}
                onToggle={() => toggleProvider(descriptor.id)}
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
