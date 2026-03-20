import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  /** Optional text button (e.g. “View queue”) — does not dismiss on its own unless `onAction` does. */
  actionLabel?: string;
  onAction?: () => void;
}

const slideIn = keyframes`
  from { transform: translate(-50%, -100%); opacity: 0; }
  to   { transform: translate(-50%, 0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translate(-50%, 0); opacity: 1; }
  to   { transform: translate(-50%, -100%); opacity: 0; }
`;

const ToastContainer = styled.div<{ $exiting: boolean }>`
  position: fixed;
  top: calc(${theme.spacing.lg} + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translate(-50%, 0);
  z-index: ${theme.zIndex.modal + 10};
  max-width: min(460px, calc(100vw - ${theme.spacing.lg} * 2));
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(12px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius['2xl']};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  line-height: 1.4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.spacing.md};
  animation: ${({ $exiting }) => ($exiting ? slideOut : slideIn)} 0.3s ease forwards;
  cursor: default;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    gap: ${theme.spacing.sm};
  }
`;

const MessageText = styled.span`
  flex: 1;
  min-width: 0;
  cursor: pointer;
`;

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${theme.colors.primary};
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;

  &:hover {
    filter: brightness(1.15);
  }
`;

const DismissIcon = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  opacity: 0.5;
  font-size: 0.75rem;
  cursor: pointer;
  line-height: 1;

  &:hover {
    opacity: 0.85;
  }
`;

export default function Toast({ message, onDismiss, actionLabel, onAction }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const displayDurationMs = 5000;
    const exitDurationMs = 300;
    const exitTimer = setTimeout(() => setExiting(true), displayDurationMs - exitDurationMs);
    const dismissTimer = setTimeout(onDismiss, displayDurationMs);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.();
  };

  return createPortal(
    <ToastContainer $exiting={exiting} role="status">
      <MessageText onClick={handleDismiss} title="Dismiss">
        {message}
        {actionLabel && onAction ? (
          <>
            {' '}
            <ActionButton type="button" onClick={handleAction}>
              {actionLabel}
            </ActionButton>
          </>
        ) : null}
      </MessageText>
      <ActionsRow>
        <DismissIcon type="button" onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </DismissIcon>
      </ActionsRow>
    </ToastContainer>,
    document.body,
  );
}
