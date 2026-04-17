import { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useProviderContext } from '@/contexts/ProviderContext';
import { flexCenter, flexColumn } from '@/styles/utils';
import Switch from '@/components/controls/Switch';
import type { ProviderId } from '@/types/domain';

interface ProviderSetupScreenProps {
  onOpenSettings?: () => void;
  onOpenLibrary?: () => void;
}

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const SetupCard = styled.div`
  ${flexColumn};
  position: relative;
  align-items: center;
  width: min(440px, 90vw);
  padding: 2.5rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.flat};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.muted.background};
  backdrop-filter: blur(12px);
  box-shadow: ${({ theme }) => theme.shadows.albumArt};
  animation: ${fadeInUp} 0.4s ease-out;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const CardHeader = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
`;

const SettingsButton = styled.button`
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.muted.foreground};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.white};
    background: ${({ theme }) => theme.colors.control.background};
  }
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.fontWeight.bold};
  margin: 0;
  text-align: center;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin: 0;
  text-align: center;
  line-height: 1.5;
`;

const ProviderGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
`;

const ProviderCardContainer = styled.div<{ $accentColor: string; $isEnabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ $isEnabled, $accentColor, theme }) =>
    $isEnabled ? $accentColor : theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.flat};
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease;
`;

const ProviderIconCircle = styled.div<{ $accentColor: string }>`
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: ${({ $accentColor }) => $accentColor};
  ${flexCenter};
  flex-shrink: 0;
  font-size: 1.25rem;
`;

const ProviderInfo = styled.div`
  ${flexColumn};
  gap: 0.25rem;
  flex: 1;
`;

const ProviderName = styled.span`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
`;

const ProviderNote = styled.span`
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.xs};
`;

const StatusBadge = styled.span<{ $status: 'connected' | 'expired' | 'idle' }>`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ $status, theme }) =>
    $status === 'connected'
      ? theme.colors.success
      : $status === 'expired'
        ? '#f0a030'
        : theme.colors.muted.foreground};
`;

const ConnectButton = styled.button<{ $accentColor: string }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  background: ${({ $accentColor }) => $accentColor};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.flat};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.foregroundDark};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.flat};
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const BrowseLibraryLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.white};
  }
`;

const PROVIDER_META: Record<ProviderId, { icon: string; accentColor: string; note: string }> = {
  spotify: { icon: '\u266B', accentColor: '#1db954', note: 'Requires Spotify Premium' },
  dropbox: { icon: '\uD83D\uDCC1', accentColor: '#0061ff', note: 'Play files from your Dropbox' },
};

const Wrapper = styled.div`
  ${flexCenter};
  width: 100%;
  min-height: 100dvh;
`;

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ProviderSetupScreen({ onOpenSettings, onOpenLibrary }: ProviderSetupScreenProps) {
  const {
    chosenProviderId,
    activeDescriptor,
    setActiveProviderId,
    registry,
    enabledProviderIds,
    toggleProvider,
  } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);
  const isSingleProvider = providers.length === 1;

  // First visit: no provider chosen yet
  if (chosenProviderId === null) {
    const hasAnyAuth = providers.some(p => p.auth.isAuthenticated());

    return (
      <Wrapper>
        <SetupCard>
          <CardHeader>
            <Title>Welcome to Vorbis Player</Title>
            {onOpenSettings && (
              <SettingsButton onClick={onOpenSettings} aria-label="Open settings">
                <GearIcon />
              </SettingsButton>
            )}
          </CardHeader>
          <Subtitle>
            {isSingleProvider
              ? 'Connect your music provider to get started'
              : 'Connect your music providers to get started. You can enable multiple providers.'}
          </Subtitle>
          <ProviderGrid>
            {providers.map((descriptor) => {
              const meta = PROVIDER_META[descriptor.id] ?? { icon: '\u266A', accentColor: '#646cff', note: '' };
              const isAuthenticated = descriptor.auth.isAuthenticated();
              const isEnabled = enabledProviderIds.includes(descriptor.id);

              return (
                <ProviderCardContainer
                  key={descriptor.id}
                  $accentColor={meta.accentColor}
                  $isEnabled={isEnabled}
                >
                  <ProviderIconCircle $accentColor={meta.accentColor}>{meta.icon}</ProviderIconCircle>
                  <ProviderInfo>
                    <ProviderName>{descriptor.name}</ProviderName>
                    {meta.note && <ProviderNote>{meta.note}</ProviderNote>}
                  </ProviderInfo>
                  {isAuthenticated ? (
                    <StatusBadge $status="connected">Connected</StatusBadge>
                  ) : (
                    <ConnectButton
                      $accentColor={meta.accentColor}
                      onClick={() => {
                        if (!isEnabled) toggleProvider(descriptor.id);
                        setActiveProviderId(descriptor.id);
                        descriptor.auth.beginLogin({ popup: true });
                      }}
                    >
                      Connect
                    </ConnectButton>
                  )}
                  {!isSingleProvider && (
                    <Switch
                      on={isEnabled}
                      onToggle={() => toggleProvider(descriptor.id)}
                      ariaLabel={`${isEnabled ? 'Disable' : 'Enable'} ${descriptor.name}`}
                      disabled={enabledProviderIds.length <= 1 && isEnabled}
                      variant="neutral"
                    />
                  )}
                </ProviderCardContainer>
              );
            })}
          </ProviderGrid>
          {hasAnyAuth && (
            <ActionButton onClick={() => {
              const authed = providers.find(p => p.auth.isAuthenticated());
              if (authed) setActiveProviderId(authed.id);
            }}>
              Continue
            </ActionButton>
          )}
          {hasAnyAuth && onOpenLibrary && (
            <BrowseLibraryLink onClick={onOpenLibrary}>
              Browse Library
            </BrowseLibraryLink>
          )}
        </SetupCard>
      </Wrapper>
    );
  }

  // All-expired reconnect screen: show each previously-enabled provider with status
  // The auto-fallthrough in ProviderContext handles the partial-expiry case,
  // so we only reach here when ALL enabled providers are expired.
  const enabledProviders = providers.filter(p => enabledProviderIds.includes(p.id));

  return (
    <Wrapper>
      <SetupCard>
        <CardHeader>
          <Title>Session Expired</Title>
          {onOpenSettings && (
            <SettingsButton onClick={onOpenSettings} aria-label="Open settings">
              <GearIcon />
            </SettingsButton>
          )}
        </CardHeader>
        <Subtitle>
          {enabledProviders.length > 1
            ? 'Your provider sessions have expired. Reconnect to continue listening.'
            : `Your ${activeDescriptor?.name ?? 'provider'} session has expired. Reconnect to continue listening.`}
        </Subtitle>
        <ProviderGrid>
          {enabledProviders.map((descriptor) => {
            const meta = PROVIDER_META[descriptor.id] ?? { icon: '\u266A', accentColor: '#646cff', note: '' };
            const isAuthenticated = descriptor.auth.isAuthenticated();
            return (
              <ProviderCardContainer
                key={descriptor.id}
                $accentColor={meta.accentColor}
                $isEnabled={isAuthenticated}
              >
                <ProviderIconCircle $accentColor={meta.accentColor}>{meta.icon}</ProviderIconCircle>
                <ProviderInfo>
                  <ProviderName>{descriptor.name}</ProviderName>
                </ProviderInfo>
                {isAuthenticated ? (
                  <StatusBadge $status="connected">Connected</StatusBadge>
                ) : (
                  <>
                    <StatusBadge $status="expired">Expired</StatusBadge>
                    <ConnectButton
                      $accentColor={meta.accentColor}
                      onClick={() => {
                        setActiveProviderId(descriptor.id);
                        descriptor.auth.beginLogin({ popup: true });
                      }}
                    >
                      Reconnect
                    </ConnectButton>
                  </>
                )}
              </ProviderCardContainer>
            );
          })}
        </ProviderGrid>
      </SetupCard>
    </Wrapper>
  );
}
