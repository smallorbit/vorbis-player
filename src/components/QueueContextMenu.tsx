import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  MenuItemButton,
  MenuRoot,
  VirtualAnchor,
} from './LibraryRoute/contextMenu/LibraryContextMenu.styled';

interface ContextMenuOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean | undefined;
}

interface QueueContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const QueueMenuItemButton = styled(MenuItemButton)`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  white-space: nowrap;

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${({ $variant }) =>
      $variant === 'destructive'
        ? theme.colors.menu.destructiveText
        : theme.colors.muted.foreground};
  }
`;

export function QueueContextMenu({ x, y, options, onClose }: QueueContextMenuProps) {
  const anchorStyle: React.CSSProperties = { left: x, top: y };

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }, []);

  // Render the Popover (and its position:fixed VirtualAnchor) in a portal to
  // document.body so it escapes any transform:ed ancestor (e.g. the queue
  // drawer / bottom sheet, which use transform for their slide animation).
  // A transform establishes a containing block for fixed-positioned children,
  // which otherwise shifts the anchor — and the menu Radix pins to it — off
  // the viewport.
  return createPortal(
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor asChild>
        <VirtualAnchor aria-hidden style={anchorStyle} />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        data-testid="queue-context-menu"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const container = e.currentTarget as HTMLElement | null;
          const first = container?.querySelector<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          );
          first?.focus();
        }}
      >
        <MenuRoot role="menu" aria-label="Queue track actions" onKeyDown={handleMenuKeyDown}>
          {options.map((option, index) => (
            <QueueMenuItemButton
              key={index}
              type="button"
              role="menuitem"
              $variant={option.destructive ? 'destructive' : 'default'}
              onClick={() => {
                option.onClick();
                onClose();
              }}
            >
              {option.icon}
              {option.label}
            </QueueMenuItemButton>
          ))}
        </MenuRoot>
      </PopoverContent>
    </Popover>,
    document.body,
  );
}
