import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useProviderContext } from '@/contexts/ProviderContext';
import Switch from '@/components/controls/Switch';
import type { ProviderId } from '@/types/domain';

const PROVIDER_COLORS: Record<ProviderId, string> = {
  spotify: '#1db954',
  dropbox: '#0061ff',
};

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  flex-shrink: 0;
`;

const ProviderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const StatusDot = styled.span<{ $color: string; $dimmed?: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  opacity: ${({ $dimmed }) => ($dimmed ? 0.35 : 1)};
  flex-shrink: 0;
`;

const ProviderName = styled.span<{ $dimmed?: boolean }>`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  opacity: ${({ $dimmed }) => ($dimmed ? 0.4 : 1)};
`;

const ProviderStatusBadge = styled.span<{ $status: 'connected' | 'expired' }>`
  font-size: 0.65rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ $status }) => ($status === 'connected' ? '#10b981' : '#f59e0b')};
`;

const ConnectButton = styled.button<{ $accentColor: string }>`
  font-size: 0.65rem;
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ $accentColor }) => $accentColor};
  background: none;
  border: 1px solid ${({ $accentColor }) => $accentColor}40;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${({ $accentColor }) => $accentColor}20;
  }
`;

const LibraryProviderBar = React.memo(function LibraryProviderBar() {
  const { registry, enabledProviderIds, toggleProvider } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  if (providers.length < 2) return null;

  return (
    <Bar>
      {providers.map((descriptor) => {
        const accentColor = PROVIDER_COLORS[descriptor.id] ?? '#646cff';
        const isEnabled = enabledProviderIds.includes(descriptor.id);
        const isConnected = descriptor.auth.isAuthenticated();
        const isLastEnabled = enabledProviderIds.length <= 1 && isEnabled;

        return (
          <ProviderRow key={descriptor.id}>
            <StatusDot $color={accentColor} $dimmed={!isEnabled} />
            <ProviderName $dimmed={!isEnabled}>{descriptor.name}</ProviderName>
            {isEnabled && isConnected && (
              <ProviderStatusBadge $status="connected">Connected</ProviderStatusBadge>
            )}
            {isEnabled && !isConnected && (
              <>
                <ProviderStatusBadge $status="expired">Expired</ProviderStatusBadge>
                <ConnectButton
                  $accentColor={accentColor}
                  onClick={() => descriptor.auth.beginLogin({ popup: true })}
                >
                  Connect
                </ConnectButton>
              </>
            )}
            <Switch
              on={isEnabled}
              onToggle={() => toggleProvider(descriptor.id)}
              ariaLabel={`${isEnabled ? 'Disable' : 'Enable'} ${descriptor.name}`}
              disabled={isLastEnabled}
            />
          </ProviderRow>
        );
      })}
    </Bar>
  );
});

LibraryProviderBar.displayName = 'LibraryProviderBar';

export default LibraryProviderBar;
