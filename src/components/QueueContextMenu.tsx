import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

interface ContextMenuOption {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface QueueContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.modal};
`;

const MenuContainer = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  z-index: ${({ theme }) => theme.zIndex.popover};
  min-width: 180px;
  background: ${({ theme }) => theme.colors.popover.background};
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.popover};
  padding: ${({ theme }) => theme.spacing.xs};
  animation: contextMenuFadeIn ${({ theme }) => theme.transitions.fast} ease-out;

  @keyframes contextMenuFadeIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const MenuItem = styled.button<{ $destructive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: none;
  border: none;
  color: ${({ theme, $destructive }) =>
    $destructive ? theme.colors.error : theme.colors.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  transition: background ${({ theme }) => theme.transitions.fast} ease;
  white-space: nowrap;
  text-align: left;

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
    color: ${({ theme, $destructive }) =>
      $destructive ? theme.colors.error : theme.colors.muted.foreground};
  }
`;

function clampToViewport(x: number, y: number, menuWidth = 200, menuHeight = 120): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(x, vw - menuWidth - 8),
    y: Math.min(y, vh - menuHeight - 8),
  };
}

export function QueueContextMenu({ x, y, options, onClose }: QueueContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { x: cx, y: cy } = clampToViewport(x, y);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <Overlay onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <MenuContainer ref={menuRef} $x={cx} $y={cy}>
        {options.map((option, index) => (
          <MenuItem
            key={index}
            $destructive={option.destructive}
            onClick={() => {
              option.onClick();
              onClose();
            }}
          >
            {option.icon}
            {option.label}
          </MenuItem>
        ))}
      </MenuContainer>
    </>,
    document.body
  );
}
