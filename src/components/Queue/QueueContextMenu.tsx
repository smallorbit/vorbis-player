import React from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { MenuItemButton, MenuRoot, VirtualAnchor } from '@/components/ui/context-menu.styled';
import { useRovingMenuKeyDown } from '@/hooks/useRovingMenuKeyDown';

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
  returnFocusRef?: React.MutableRefObject<HTMLElement | null> | undefined;
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

export function QueueContextMenu({ x, y, options, onClose, returnFocusRef }: QueueContextMenuProps) {
  const anchorStyle: React.CSSProperties = { left: x, top: y };
  const handleMenuKeyDown = useRovingMenuKeyDown();

  const returnFocusAndClose = () => {
    returnFocusRef?.current?.focus({ preventScroll: true });
    onClose();
  };

  return createPortal(
    <Popover open onOpenChange={(open) => { if (!open) returnFocusAndClose(); }}>
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
                returnFocusAndClose();
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
