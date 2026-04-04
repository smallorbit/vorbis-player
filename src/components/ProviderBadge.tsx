import React from 'react';
import styled from 'styled-components';
import type { ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';

const BadgeContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$iconOnly'].includes(prop),
})<{ $iconOnly: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: ${({ $iconOnly }) => $iconOnly ? '4px' : '3px 8px 3px 4px'};
  pointer-events: none;
  user-select: none;
`;

const IconWrapper = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ProviderName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  line-height: 1;
`;

interface ProviderBadgeProps {
  providerId: ProviderId;
  iconSize?: number;
  iconOnly?: boolean;
  className?: string;
}

export const ProviderBadge: React.FC<ProviderBadgeProps> = React.memo(({ providerId, iconSize = 16, iconOnly = false, className }) => {
  const descriptor = providerRegistry.get(providerId);
  if (!descriptor) return null;

  const IconComponent = descriptor.icon;

  return (
    <BadgeContainer $iconOnly={iconOnly} className={className}>
      <IconWrapper $size={iconSize}>
        {IconComponent ? <IconComponent size={iconSize} /> : null}
      </IconWrapper>
      {!iconOnly && <ProviderName>{descriptor.name}</ProviderName>}
    </BadgeContainer>
  );
});

ProviderBadge.displayName = 'ProviderBadge';
