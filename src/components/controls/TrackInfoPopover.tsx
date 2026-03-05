import { useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/theme';

type PopoverType = 'artist' | 'album';

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
  const containerRef = useRef<HTMLDivElement>(null);

  const positionPopover = useCallback(() => {
    if (!anchorRect) return { x: 0, y: 0 };
    const x = anchorRect.left + anchorRect.width / 2;
    const y = anchorRect.bottom + 8;
    return { x, y };
  }, [anchorRect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { x, y } = positionPopover();

  if (!anchorRect) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <PopoverContainer ref={containerRef} $x={x} $y={y}>
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

export const AppleMusicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0 0 19.7.218C18.965.073 18.225.022 17.483.01c-.225-.005-.45-.01-.675-.01H7.192c-.225 0-.45.005-.675.01C5.775.022 5.035.073 4.3.218a5.022 5.022 0 0 0-1.874.673C1.308 1.624.563 2.624.246 3.934a9.23 9.23 0 0 0-.24 2.19C.001 6.349 0 6.574 0 6.799v10.402c0 .225.001.45.006.675a9.23 9.23 0 0 0 .24 2.19c.317 1.31 1.062 2.31 2.18 3.043A5.022 5.022 0 0 0 4.3 23.782c.735.145 1.475.196 2.217.208.225.005.45.01.675.01h9.616c.225 0 .45-.005.675-.01.742-.012 1.482-.063 2.217-.208a5.022 5.022 0 0 0 1.874-.673c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 0 0 .24-2.19c.005-.225.006-.45.006-.675V6.799c0-.225-.001-.45-.006-.675zM16.95 13.793v2.957c0 .456-.05.905-.217 1.338-.327.84-.989 1.32-1.858 1.476a3.094 3.094 0 0 1-.665.065c-.89-.02-1.626-.59-1.806-1.45-.186-.886.248-1.79 1.076-2.138.36-.151.74-.26 1.112-.388.31-.106.466-.314.478-.645.003-.07.002-.14.002-.21V10.89c0-.182-.038-.23-.218-.198l-5.293 1.017c-.032.006-.064.014-.097.022-.123.037-.17.097-.172.226-.002.318-.001 5.362-.002 5.68 0 .456-.05.905-.217 1.338-.327.84-.989 1.32-1.858 1.476a3.094 3.094 0 0 1-.665.065c-.89-.02-1.626-.59-1.806-1.45-.186-.886.248-1.79 1.076-2.138.36-.151.74-.26 1.112-.388.31-.106.465-.314.477-.645.003-.07.002-.14.002-.21V8.154c0-.393.12-.558.5-.64L16.1 5.947c.334-.066.512.032.558.378.01.078.014.157.014.236v7.232z" />
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

export default TrackInfoPopover;
