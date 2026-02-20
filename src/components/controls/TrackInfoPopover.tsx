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
  z-index: ${theme.zIndex.modal};
`;

const PopoverContainer = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  z-index: ${theme.zIndex.modal + 1};
  min-width: 200px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.75rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
  padding: 0.375rem;
  animation: popoverFadeIn 0.15s ease-out;
  transform: translateX(-50%);

  @keyframes popoverFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px);
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
  padding: 0.625rem 0.75rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.12s ease;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &:active {
    background: rgba(255, 255, 255, 0.15);
  }

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: rgba(255, 255, 255, 0.6);
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

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export default TrackInfoPopover;
