import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';
import type { RadioProgressPhase } from '@/types/radio';

interface RadioProgressContentProps {
  phase: RadioProgressPhase;
  trackCount?: number;
  onDismiss: () => void;
  onViewQueue: () => void;
}

const PHASE_MESSAGES: Record<RadioProgressPhase, string> = {
  'fetching-catalog': 'Scanning your library…',
  generating: 'Finding similar tracks…',
  resolving: 'Resolving additional tracks…',
  done: '',
};

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const ContentRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius['2xl']};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  line-height: 1.4;
  max-width: min(460px, calc(100vw - ${theme.spacing.lg} * 2));

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

export function RadioProgressContent({
  phase,
  trackCount,
  onDismiss,
  onViewQueue,
}: RadioProgressContentProps): React.ReactElement {
  const isDone = phase === 'done';
  const message = isDone
    ? `Radio ready — ${trackCount ?? 0} track${(trackCount ?? 0) !== 1 ? 's' : ''}`
    : PHASE_MESSAGES[phase];

  return (
    <ContentRow role="status" aria-live="polite">
      {isDone ? <DoneIcon aria-hidden="true">✓</DoneIcon> : <Spinner aria-hidden="true" />}
      <MessageText>{message}</MessageText>
      {isDone && (
        <ActionButton type="button" onClick={onViewQueue}>
          View queue
        </ActionButton>
      )}
      <DismissIcon type="button" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </DismissIcon>
    </ContentRow>
  );
}
