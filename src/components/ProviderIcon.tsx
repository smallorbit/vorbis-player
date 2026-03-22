import styled from 'styled-components';
import type { ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';

/**
 * Small provider badge icon for use in library
 * thumbnails and player controls when multiple providers are enabled.
 */

const BadgeWrapper = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

interface ProviderIconProps {
  provider: ProviderId;
  /** Icon diameter in pixels. Default: 20 */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ProviderIcon({ provider, size = 20, className, style }: ProviderIconProps) {
  const descriptor = providerRegistry.get(provider);
  const IconComponent = descriptor?.icon;

  return (
    <BadgeWrapper $size={size} className={className} style={style}>
      {IconComponent ? <IconComponent size={Math.round(size * 0.6)} /> : null}
    </BadgeWrapper>
  );
}
