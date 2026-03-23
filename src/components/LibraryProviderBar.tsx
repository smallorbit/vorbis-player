import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useProviderContext } from '@/contexts/ProviderContext';
import Switch from '@/components/controls/Switch';

const TOGGLE_ON_COLOR = '#4ade80';
const TOGGLE_OFF_COLOR = 'rgba(255, 255, 255, 0.25)';

const Bar = styled.div<{ $variant?: 'default' | 'drawerBottom' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $variant }) => ($variant === 'drawerBottom' ? 'flex-start' : 'center')};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  row-gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme, $variant }) => ($variant === 'drawerBottom' ? '0' : `${theme.spacing.xs} 0`)};
  flex-shrink: ${({ $variant }) => ($variant === 'drawerBottom' ? 1 : 0)};
  ${({ $variant }) =>
    $variant === 'drawerBottom'
      ? `
    flex: 1 1 auto;
    min-width: 0;
  `
      : ''}
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

const ConnectButton = styled.button`
  font-size: 0.65rem;
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${TOGGLE_ON_COLOR};
  background: none;
  border: 1px solid ${TOGGLE_ON_COLOR}40;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${TOGGLE_ON_COLOR}20;
  }
`;

const DrawerOffBadge = styled.span`
  font-size: 0.65rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ theme }) => theme.colors.muted.foreground};
  opacity: 0.85;
`;

interface LibraryProviderBarProps {
  variant?: 'default' | 'drawerBottom';
}

const LibraryProviderBar = React.memo(function LibraryProviderBar({ variant = 'default' }: LibraryProviderBarProps) {
  const { registry, enabledProviderIds, toggleProvider } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  if (providers.length < 2) return null;

  const drawerBottom = variant === 'drawerBottom';

  return (
    <Bar $variant={variant}>
      {providers.map((descriptor) => {
        const isEnabled = enabledProviderIds.includes(descriptor.id);
        const isConnected = descriptor.auth.isAuthenticated();
        const isLastEnabled = enabledProviderIds.length <= 1 && isEnabled;
        const dotColor = isEnabled ? TOGGLE_ON_COLOR : TOGGLE_OFF_COLOR;

        return (
          <ProviderRow key={descriptor.id}>
            <StatusDot $color={dotColor} />
            <ProviderName $dimmed={!isEnabled}>{descriptor.name}</ProviderName>
            {drawerBottom && !isEnabled && <DrawerOffBadge>Off</DrawerOffBadge>}
            {isEnabled && isConnected && (
              <ProviderStatusBadge $status="connected">Connected</ProviderStatusBadge>
            )}
            {isEnabled && !isConnected && (
              <>
                <ProviderStatusBadge $status="expired">Expired</ProviderStatusBadge>
                <ConnectButton
                  onClick={() => descriptor.auth.beginLogin({ popup: true })}
                >
                  Connect
                </ConnectButton>
              </>
            )}
            {!drawerBottom && (
              <Switch
                on={isEnabled}
                onToggle={() => toggleProvider(descriptor.id)}
                ariaLabel={`${isEnabled ? 'Disable' : 'Enable'} ${descriptor.name}`}
                disabled={isLastEnabled}
                variant="neutral"
              />
            )}
          </ProviderRow>
        );
      })}
    </Bar>
  );
});

LibraryProviderBar.displayName = 'LibraryProviderBar';

export default LibraryProviderBar;
