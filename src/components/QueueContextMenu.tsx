import React, { useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

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

const VirtualAnchor = styled.div`
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
`;

const MenuRoot = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: ${theme.spacing.xs};
  gap: 1px;
`;

const MenuItemButton = styled.button<{ $destructive?: boolean | undefined }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  color: ${({ $destructive }) =>
    $destructive ? theme.colors.error : theme.colors.foreground};
  border-radius: ${theme.borderRadius.lg};
  cursor: pointer;
  white-space: nowrap;
  transition: background ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${theme.colors.control.background};
  }

  &:active:not(:disabled) {
    background: ${theme.colors.control.backgroundHover};
  }

  &:focus-visible {
    background: ${theme.colors.control.background};
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: -2px;
  }

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: ${({ $destructive }) =>
      $destructive ? theme.colors.error : theme.colors.muted.foreground};
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

  return (
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
            <MenuItemButton
              key={index}
              type="button"
              role="menuitem"
              $destructive={option.destructive}
              onClick={() => {
                option.onClick();
                onClose();
              }}
            >
              {option.icon}
              {option.label}
            </MenuItemButton>
          ))}
        </MenuRoot>
      </PopoverContent>
    </Popover>
  );
}
