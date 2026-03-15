import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const slideIn = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(-100%); opacity: 0; }
`;

const ToastContainer = styled.div<{ $exiting: boolean }>`
  position: fixed;
  top: ${theme.spacing.lg};
  left: 50%;
  transform: translateX(-50%);
  z-index: ${theme.zIndex.modal + 10};
  max-width: min(420px, 90vw);
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
  gap: ${theme.spacing.sm};
  animation: ${({ $exiting }) => ($exiting ? slideOut : slideIn)} 0.3s ease forwards;
  cursor: pointer;
`;

const DismissIcon = styled.span`
  flex-shrink: 0;
  opacity: 0.5;
  font-size: 0.75rem;
`;

export default function Toast({ message, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Start exit animation 300ms before the parent auto-dismisses
    const timer = setTimeout(() => setExiting(true), 4700);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  return createPortal(
    <ToastContainer $exiting={exiting} onClick={handleClick}>
      <span>{message}</span>
      <DismissIcon>✕</DismissIcon>
    </ToastContainer>,
    document.body,
  );
}
