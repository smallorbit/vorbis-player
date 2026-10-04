import type { ReactNode } from 'react';
import styled from 'styled-components';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

type PopoverType = 'artist' | 'album' | 'playlist' | 'radio';

interface PopoverOption {
  label: string;
  icon: ReactNode;
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
const OptionButton = styled.button<{ $disabled?: boolean | undefined }>`
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

export default TrackInfoPopover;
