import * as React from 'react';
import styled from 'styled-components';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

type PopoverType = 'artist' | 'album' | 'playlist' | 'radio';

interface PopoverOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface TrackInfoPopoverProps {
  type: PopoverType;
  options: PopoverOption[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}

// OptionButton retained — purely visual, no layout role. Radix Popover owns
// positioning, click-outside, Escape, focus return, and motion via the shadcn
// `popover` primitive; this component just renders the option list.
const OptionButton = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  min-height: 44px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: none;
  border: none;
  color: ${({ theme, $disabled }) =>
    $disabled ? theme.colors.muted.foreground : theme.colors.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  transition: background ${({ theme }) => theme.transitions.fast} ease;
  white-space: nowrap;

  &:hover {
    background: ${({ theme, $disabled }) =>
      $disabled ? 'transparent' : theme.colors.control.background};
  }

  &:active {
    background: ${({ theme, $disabled }) =>
      $disabled ? 'transparent' : theme.colors.control.backgroundHover};
  }

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.colors.muted.foreground};
  }
`;

function TrackInfoPopover({ options, anchorRect, onClose }: TrackInfoPopoverProps) {
  if (!anchorRect) return null;

  // Virtual anchor div: Radix Popover positions Content relative to a DOM element.
  // Caller provides DOMRect, not a ref. We render a zero-size fixed div at the rect's
  // centre-bottom as the Radix Anchor — avoids restructuring TrackInfo.tsx's click-handler
  // + state model. aria-hidden + pointer-events:none so it's invisible to users and AT.
  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor asChild>
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: anchorRect.left + anchorRect.width / 2,
            top: anchorRect.bottom,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        // Escape + click-outside dismiss are handled via onOpenChange above —
        // Radix already invokes onOpenChange(false) for both gestures. Adding
        // onEscapeKeyDown/onPointerDownOutside handlers here would double-fire
        // onClose (once from the gesture handler, once from onOpenChange).
        // Suppress Radix's default focus-trap — popover is a lightweight menu, not a modal
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((option, index) => (
          <OptionButton
            key={index}
            $disabled={option.disabled}
            aria-disabled={option.disabled ? 'true' : undefined}
            title={option.title}
            onClick={() => {
              if (option.disabled) return;
              option.onClick();
              onClose();
            }}
          >
            {option.icon}
            {option.label}
          </OptionButton>
        ))}
      </PopoverContent>
    </Popover>
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

export const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const ICON_MAP: Record<string, React.FC> = {
  discogs: DiscogsIcon,
  musicbrainz: MusicBrainzIcon,
};

export default TrackInfoPopover;
