import styled, { keyframes } from 'styled-components';
import { useProviderContext } from '@/contexts/ProviderContext';
import { flexCenter, flexColumn, cardBase } from '@/styles/utils';
import type { ProviderId } from '@/types/domain';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const SetupCard = styled.div`
  ${cardBase};
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

const ProviderCard = styled.button<{ $accentColor: string; $isEnabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ $isEnabled, $accentColor, theme }) =>
    $isEnabled ? $accentColor : theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius['2xl']};
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: ${({ $accentColor }) => $accentColor};
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }
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

const StatusBadge = styled.span<{ $connected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ $connected, theme }) => $connected ? theme.colors.success : theme.colors.muted.foreground};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
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
  const { chosenProviderId, activeDescriptor, setActiveProviderId, registry, enabledProviderIds, toggleProvider, getDescriptor } = useProviderContext();
  const providers = registry.getAll();

  // First visit: no provider chosen yet
  if (chosenProviderId === null) {
    const hasAnyAuth = providers.some(p => p.auth.isAuthenticated());

    return (
      <Wrapper>
        <SetupCard>
          <Title>Welcome to Vorbis Player</Title>
          <Subtitle>
            {providers.length >= 2
              ? 'Connect your music providers to get started. You can enable multiple providers.'
              : 'Choose a music provider to get started'}
          </Subtitle>
          <ProviderGrid>
            {providers.map((descriptor) => {
              const meta = PROVIDER_META[descriptor.id] ?? { icon: '♪', accentColor: '#646cff', note: '' };
              const isAuthenticated = descriptor.auth.isAuthenticated();
              return (
                <ProviderCard
                  key={descriptor.id}
                  $accentColor={meta.accentColor}
                  $isEnabled={isAuthenticated}
                  onClick={() => {
                    if (!isAuthenticated) {
                      setActiveProviderId(descriptor.id);
                      descriptor.auth.beginLogin();
                    } else {
                      // Already authenticated — just set as active
                      setActiveProviderId(descriptor.id);
                    }
                  }}
                >
                  <ProviderIconCircle $accentColor={meta.accentColor}>{meta.icon}</ProviderIconCircle>
                  <ProviderInfo>
                    <ProviderName>{descriptor.name}</ProviderName>
                    {meta.note && <ProviderNote>{meta.note}</ProviderNote>}
                  </ProviderInfo>
                  {isAuthenticated && <StatusBadge $connected>Connected</StatusBadge>}
                </ProviderCard>
              );
            })}
          </ProviderGrid>
          {hasAnyAuth && (
            <ActionButton onClick={() => {
              // Pick the first authenticated provider as active
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

  // Reconnect screen: session expired for the active provider
  // Check if there are other authenticated providers we can switch to
  const otherAuthenticatedProviders = providers.filter(
    p => p.id !== activeDescriptor?.id && p.auth.isAuthenticated() && enabledProviderIds.includes(p.id)
  );

  return (
    <Wrapper>
      <SetupCard>
        <Title>Reconnect to {activeDescriptor?.name}</Title>
        <Subtitle>Your session has expired. Reconnect to continue listening.</Subtitle>
        <ActionButton onClick={() => activeDescriptor?.auth.beginLogin()}>
          Reconnect {activeDescriptor?.name}
        </ActionButton>
        {otherAuthenticatedProviders.length > 0 && (
          <>
            <Subtitle>Or switch to a connected provider:</Subtitle>
            <ProviderGrid>
              {otherAuthenticatedProviders.map((descriptor) => {
                const meta = PROVIDER_META[descriptor.id] ?? { icon: '♪', accentColor: '#646cff', note: '' };
                return (
                  <ProviderCard
                    key={descriptor.id}
                    $accentColor={meta.accentColor}
                    $isEnabled
                    onClick={() => setActiveProviderId(descriptor.id)}
                  >
                    <ProviderIconCircle $accentColor={meta.accentColor}>{meta.icon}</ProviderIconCircle>
                    <ProviderInfo>
                      <ProviderName>{descriptor.name}</ProviderName>
                    </ProviderInfo>
                    <StatusBadge $connected>Connected</StatusBadge>
                  </ProviderCard>
                );
              })}
            </ProviderGrid>
          </>
        )}
        {providers.length >= 2 && otherAuthenticatedProviders.length === 0 && (
          <Subtitle style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setActiveProviderId(null)}>
            Switch provider
          </Subtitle>
        )}
      </SetupCard>
    </Wrapper>
  );
}
