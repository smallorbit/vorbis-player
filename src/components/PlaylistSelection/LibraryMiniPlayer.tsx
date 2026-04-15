import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';
import { useCurrentTrackContext } from '@/contexts/TrackContext';

const Strip = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  border-top: 1px solid ${theme.colors.borderSubtle};
  border-radius: 0 0 1.25rem 1.25rem;
  cursor: pointer;
  color: ${theme.colors.foreground};
  text-align: left;
  transition: background ${theme.transitions.fast};

  &:hover {
    background: rgba(0, 0, 0, 0.75);
  }

  &:active {
    background: rgba(0, 0, 0, 0.85);
  }
`;

const Artwork = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.md};
  object-fit: cover;
  flex-shrink: 0;
`;

const ArtworkPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.md};
  background: ${theme.colors.control.background};
  flex-shrink: 0;
`;

const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TrackName = styled.span`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ArtistName = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.muted.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const equalize = keyframes`
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
`;

const Bars = styled.div<{ $paused: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  padding-right: ${theme.spacing.xs};

  & > span {
    display: block;
    width: 3px;
    height: 100%;
    background: ${theme.colors.muted.foreground};
    border-radius: 1px;
    transform-origin: bottom;
    animation: ${equalize} 0.8s ease-in-out infinite;
    animation-play-state: ${({ $paused }) => ($paused ? 'paused' : 'running')};
  }

  & > span:nth-child(1) { animation-delay: 0s; }
  & > span:nth-child(2) { animation-delay: 0.2s; }
  & > span:nth-child(3) { animation-delay: 0.4s; }
`;

interface LibraryMiniPlayerProps {
  isPlaying: boolean;
  onNavigateToPlayer: () => void;
}

export function LibraryMiniPlayer({ isPlaying, onNavigateToPlayer }: LibraryMiniPlayerProps): JSX.Element | null {
  const { currentTrack } = useCurrentTrackContext();

  if (!currentTrack) return null;

  return (
    <Strip
      onClick={onNavigateToPlayer}
      type="button"
      aria-label={`Now playing: ${currentTrack.name} by ${currentTrack.artists}. Tap to return to player.`}
    >
      {currentTrack.image ? (
        <Artwork src={currentTrack.image} alt="" />
      ) : (
        <ArtworkPlaceholder />
      )}
      <Info>
        <TrackName>{currentTrack.name}</TrackName>
        <ArtistName>{currentTrack.artists}</ArtistName>
      </Info>
      <Bars $paused={!isPlaying}>
        <span />
        <span />
        <span />
      </Bars>
    </Strip>
  );
}
