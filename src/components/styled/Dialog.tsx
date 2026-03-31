import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const dialogFadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const DialogOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.zIndex.modal + 5};
  background: ${theme.colors.overlay.bar};
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${dialogFadeIn} 0.2s ease;
`;

export const DialogBox = styled.div`
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(16px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius['2xl']};
  padding: ${theme.spacing.lg};
  width: min(380px, 90vw);
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

export const DialogTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
`;

export const DialogErrorText = styled.div`
  font-size: ${theme.fontSize.xs};
  color: #ef4444;
  line-height: 1.4;
`;

export const DialogButtonRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
`;

export const DialogButton = styled.button<{ $primary?: boolean; $destructive?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: 1px solid ${({ $primary, $destructive }) =>
    ($primary || $destructive) ? 'transparent' : theme.colors.control.border};
  background: ${({ $primary, $destructive }) =>
    $destructive ? 'rgba(239, 68, 68, 0.85)'
    : $primary ? 'rgba(255, 255, 255, 0.9)'
    : 'transparent'};
  color: ${({ $primary, $destructive }) =>
    $destructive ? '#fff'
    : $primary ? '#111'
    : theme.colors.white};

  &:hover:not(:disabled) {
    background: ${({ $primary, $destructive }) =>
      $destructive ? 'rgba(239, 68, 68, 1)'
      : $primary ? 'rgba(255, 255, 255, 1)'
      : theme.colors.control.backgroundHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
