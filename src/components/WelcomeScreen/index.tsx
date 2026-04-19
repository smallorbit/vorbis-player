import React, { useCallback, useMemo } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useWelcomeSeen } from '@/hooks/useWelcomeSeen';
import ProviderIcon from '@/components/ProviderIcon';
import type { ProviderId } from '@/types/domain';
import {
  WelcomeRoot,
  WelcomeContent,
  HeroTitle,
  HeroSubtitle,
  ProviderStatusBlock,
  ProviderStatusHeading,
  ProviderStatusList,
  ProviderStatusItem,
  ProviderStatusLabel,
  ProviderStatusPill,
  ProviderStatusEmpty,
  CtaRow,
  PrimaryCta,
  DismissButton,
} from './styled';

interface WelcomeScreenProps {
  onConnectProvider: () => void;
  onBrowseLibrary: () => void;
  onDismiss?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onConnectProvider,
  onBrowseLibrary,
  onDismiss,
}) => {
  const { enabledProviderIds, connectedProviderIds, getDescriptor } = useProviderContext();
  const [, setWelcomeSeen] = useWelcomeSeen();

  const hasConnectedProvider = connectedProviderIds.length > 0;

  const providerRows = useMemo(
    () =>
      enabledProviderIds
        .map((id: ProviderId) => {
          const descriptor = getDescriptor(id);
          if (!descriptor) return null;
          return {
            id,
            name: descriptor.name,
            connected: connectedProviderIds.includes(id),
          };
        })
        .filter((row): row is { id: ProviderId; name: string; connected: boolean } => row !== null),
    [enabledProviderIds, connectedProviderIds, getDescriptor],
  );

  const handlePrimaryCta = useCallback(() => {
    if (hasConnectedProvider) {
      onBrowseLibrary();
    } else {
      onConnectProvider();
    }
  }, [hasConnectedProvider, onBrowseLibrary, onConnectProvider]);

  const handleDismiss = useCallback(() => {
    setWelcomeSeen(true);
    onDismiss?.();
  }, [setWelcomeSeen, onDismiss]);

  const primaryCtaLabel = hasConnectedProvider ? 'Browse your library' : 'Connect a provider';
  const subtitle = hasConnectedProvider
    ? 'Jump into your music whenever you are ready.'
    : 'Connect a music source to start listening.';

  return (
    <WelcomeRoot role="region" aria-label="Welcome to Vorbis Player">
      <WelcomeContent>
        <div>
          <HeroTitle>Welcome to Vorbis Player</HeroTitle>
          <HeroSubtitle>{subtitle}</HeroSubtitle>
        </div>

        <ProviderStatusBlock>
          <ProviderStatusHeading>Music sources</ProviderStatusHeading>
          {providerRows.length === 0 ? (
            <ProviderStatusEmpty>
              No providers enabled yet. Connect one to get started.
            </ProviderStatusEmpty>
          ) : (
            <ProviderStatusList>
              {providerRows.map((row) => (
                <ProviderStatusItem key={row.id}>
                  <ProviderIcon provider={row.id} size={18} />
                  <ProviderStatusLabel>{row.name}</ProviderStatusLabel>
                  <ProviderStatusPill $connected={row.connected}>
                    {row.connected ? 'Connected' : 'Not connected'}
                  </ProviderStatusPill>
                </ProviderStatusItem>
              ))}
            </ProviderStatusList>
          )}
        </ProviderStatusBlock>

        <CtaRow>
          <PrimaryCta type="button" onClick={handlePrimaryCta}>
            {primaryCtaLabel}
          </PrimaryCta>
          <DismissButton type="button" onClick={handleDismiss}>
            Don&apos;t show this again
          </DismissButton>
        </CtaRow>
      </WelcomeContent>
    </WelcomeRoot>
  );
};

export default WelcomeScreen;
export { WelcomeScreen };
