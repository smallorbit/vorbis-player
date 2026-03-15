import styled from 'styled-components';
import type { ProviderId } from '@/types/domain';

const PROVIDER_COLORS: Record<ProviderId, string> = {
  spotify: '#1db954',
  dropbox: '#0061FF',
};

/**
 * Small provider badge icon (Spotify or Dropbox logo) for use in library
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

function SpotifyLogo({ size }: { size: number }) {
  const iconSize = size * 0.6;
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={PROVIDER_COLORS.spotify}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function DropboxLogo({ size }: { size: number }) {
  const iconSize = size * 0.6;
  return (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={PROVIDER_COLORS.dropbox}>
      <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
    </svg>
  );
}

interface ProviderIconProps {
  provider: ProviderId;
  /** Icon diameter in pixels. Default: 20 */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ProviderIcon({ provider, size = 20, className, style }: ProviderIconProps) {
  return (
    <BadgeWrapper $size={size} className={className} style={style}>
      {provider === 'spotify' ? <SpotifyLogo size={size} /> : <DropboxLogo size={size} />}
    </BadgeWrapper>
  );
}

export { PROVIDER_COLORS };
