import { useEffect } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

type PopoverType = 'artist' | 'album' | 'playlist';

interface PopoverOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface TrackInfoPopoverProps {
  type: PopoverType;
  options: PopoverOption[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.modal};
`;

const PopoverContainer = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  z-index: ${({ theme }) => theme.zIndex.popover};
  min-width: 200px;
  background: ${({ theme }) => theme.colors.popover.background};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.popover};
  padding: ${({ theme }) => theme.spacing.xs};
  animation: popoverFadeIn ${({ theme }) => theme.transitions.fast} ease-out;
  transform: translateX(-50%);

  @keyframes popoverFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(${({ theme }) => theme.spacing.xs});
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;

const OptionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  transition: background ${({ theme }) => theme.transitions.fast} ease;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.control.background};
  }

  &:active {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.colors.muted.foreground};
  }
`;

function TrackInfoPopover({ options, anchorRect, onClose }: TrackInfoPopoverProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!anchorRect) return null;

  const x = anchorRect.left + anchorRect.width / 2;
  const y = anchorRect.bottom + 8;

  return (
    <>
      <Overlay onClick={onClose} />
      <PopoverContainer $x={x} $y={y}>
        {options.map((option, index) => (
          <OptionButton
            key={index}
            onClick={() => {
              option.onClick();
              onClose();
            }}
          >
            {option.icon}
            {option.label}
          </OptionButton>
        ))}
      </PopoverContainer>
    </>
  );
}

// Icon components
export const LibraryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

export const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const DiscogsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 2.16c5.436 0 9.84 4.404 9.84 9.84 0 5.436-4.404 9.84-9.84 9.84-5.436 0-9.84-4.404-9.84-9.84 0-5.436 4.404-9.84 9.84-9.84zm0 3.12A6.726 6.726 0 0 0 5.28 12 6.726 6.726 0 0 0 12 18.72 6.726 6.726 0 0 0 18.72 12 6.726 6.726 0 0 0 12 5.28zm0 2.16A4.564 4.564 0 0 1 16.56 12 4.564 4.564 0 0 1 12 16.56 4.564 4.564 0 0 1 7.44 12 4.564 4.564 0 0 1 12 7.44zm0 2.64a1.92 1.92 0 1 0 0 3.84 1.92 1.92 0 0 0 0-3.84z" />
  </svg>
);

const MusicBrainzIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5c5.799 0 10.5 4.701 10.5 10.5S17.799 22.5 12 22.5 1.5 17.799 1.5 12 6.201 1.5 12 1.5zM8.5 6.5v11h2v-4h3c1.933 0 3.5-1.567 3.5-3.5S15.433 6.5 13.5 6.5h-5zm2 2h3c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5h-3v-3z" />
  </svg>
);

export const AddToLibraryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const RemoveFromLibraryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const AddToQueueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h14M3 12h14M3 18h10" />
    <path d="M19 15v6M16 18h6" />
  </svg>
);

export const ICON_MAP: Record<string, React.FC> = {
  discogs: DiscogsIcon,
  musicbrainz: MusicBrainzIcon,
};

export default TrackInfoPopover;
