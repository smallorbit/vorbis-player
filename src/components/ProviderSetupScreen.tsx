import styled, { keyframes } from 'styled-components';
import { useProviderContext } from '@/contexts/ProviderContext';
import { flexCenter, flexColumn } from '@/styles/utils';
import Switch from '@/components/controls/Switch';
import type { ProviderId } from '@/types/domain';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const SetupCard = styled.div`
  ${flexColumn};
  align-items: center;
  width: min(440px, 90vw);
  padding: 2.5rem 2rem;
  border-radius: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.muted.background};
  backdrop-filter: blur(12px);
  box-shadow: ${({ theme }) => theme.shadows.albumArt};
  animation: ${fadeInUp} 0.4s ease-out;
  gap: ${({ theme }) => theme.spacing.lg};
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
  border-radius: ${({ theme }) => theme.borderRadius['2xl']};
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
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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
  border-radius: ${({ theme }) => theme.borderRadius['2xl']};
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

const PROVIDER_META: Record<ProviderId, { icon: string; accentColor: string; note: string }> = {
  spotify: { icon: '♫', accentColor: '#1db954', note: 'Requires Spotify Premium' },
  dropbox: { icon: '📁', accentColor: '#0061ff', note: 'Play files from your Dropbox' },
};

const Wrapper = styled.div`
  ${flexCenter};
  width: 100%;
  min-height: 100dvh;
`;

export default function ProviderSetupScreen() {
  const {
    chosenProviderId,
    activeDescriptor,
    setActiveProviderId,
    registry,
    enabledProviderIds,
    toggleProvider,
  } = useProviderContext();
  const providers = registry.getAll();
  const isSingleProvider = providers.length === 1;

  // First visit: no provider chosen yet
  if (chosenProviderId === null) {
    const hasAnyAuth = providers.some(p => p.auth.isAuthenticated());

    return (
      <Wrapper>
        <SetupCard>
          <Title>Welcome to Vorbis Player</Title>
          <Subtitle>
            {isSingleProvider
              ? 'Connect your music provider to get started'
              : 'Connect your music providers to get started. You can enable multiple providers.'}
          </Subtitle>
          <ProviderGrid>
            {providers.map((descriptor) => {
              const meta = PROVIDER_META[descriptor.id] ?? { icon: '♪', accentColor: '#646cff', note: '' };
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
                        descriptor.auth.beginLogin();
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
        <Title>Session Expired</Title>
        <Subtitle>
          {enabledProviders.length > 1
            ? 'Your provider sessions have expired. Reconnect to continue listening.'
            : `Your ${activeDescriptor?.name ?? 'provider'} session has expired. Reconnect to continue listening.`}
        </Subtitle>
        <ProviderGrid>
          {enabledProviders.map((descriptor) => {
            const meta = PROVIDER_META[descriptor.id] ?? { icon: '♪', accentColor: '#646cff', note: '' };
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
                        descriptor.auth.beginLogin();
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
