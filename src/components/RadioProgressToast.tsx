import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';
import type { RadioProgressPhase } from '@/types/radio';

interface RadioProgressToastProps {
  phase: RadioProgressPhase;
  trackCount?: number;
  onDismiss: () => void;
  onViewQueue: () => void;
}

const PHASE_MESSAGES: Record<RadioProgressPhase, string> = {
  'fetching-catalog': 'Scanning your library\u2026',
  generating: 'Finding similar tracks\u2026',
  resolving: 'Resolving additional tracks\u2026',
  done: '',
};

const DONE_AUTODISMISS_MS = 6000;
const EXIT_DURATION_MS = 300;

// ─── Animations ──────────────────────────────────────────────────────────────

const slideIn = keyframes`
  from { transform: translate(-50%, -100%); opacity: 0; }
  to   { transform: translate(-50%, 0);    opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translate(-50%, 0);    opacity: 1; }
  to   { transform: translate(-50%, -100%); opacity: 0; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// ─── Styled components ────────────────────────────────────────────────────────

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
  border-radius: ${theme.borderRadius.flat};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  animation: ${({ $exiting }) => ($exiting ? slideOut : slideIn)} ${EXIT_DURATION_MS}ms ease forwards;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    gap: ${theme.spacing.sm};
  }
`;

const Spinner = styled.span`
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: ${theme.colors.white};
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

const DoneIcon = styled.span`
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: ${theme.colors.primary};
`;

const MessageText = styled.span`
  flex: 1;
  min-width: 0;
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
  flex-shrink: 0;

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
  flex-shrink: 0;

  &:hover {
    opacity: 0.85;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RadioProgressToast({
  phase,
  trackCount,
  onDismiss,
  onViewQueue,
}: RadioProgressToastProps) {
  const [exiting, setExiting] = useState(false);

  // Auto-dismiss after the done phase lingers long enough for the user to see it.
  useEffect(() => {
    if (phase !== 'done') return;
    const exitTimer = setTimeout(() => setExiting(true), DONE_AUTODISMISS_MS - EXIT_DURATION_MS);
    const dismissTimer = setTimeout(onDismiss, DONE_AUTODISMISS_MS);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [phase, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, EXIT_DURATION_MS);
  };

  const handleViewQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewQueue();
  };

  const isDone = phase === 'done';
  const message = isDone
    ? `Radio ready\u00a0\u2014\u00a0${trackCount ?? 0} track${(trackCount ?? 0) !== 1 ? 's' : ''}`
    : PHASE_MESSAGES[phase];

  return createPortal(
    <ToastContainer $exiting={exiting} role="status" aria-live="polite">
      {isDone ? (
        <DoneIcon aria-hidden="true">✓</DoneIcon>
      ) : (
        <Spinner aria-hidden="true" />
      )}
      <MessageText>{message}</MessageText>
      {isDone && (
        <ActionButton type="button" onClick={handleViewQueue}>
          View queue
        </ActionButton>
      )}
      <DismissIcon type="button" onClick={handleDismiss} aria-label="Dismiss">
        ✕
      </DismissIcon>
    </ToastContainer>,
    document.body,
  );
}
