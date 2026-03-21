import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.zIndex.modal + 5};
  background: ${theme.colors.overlay.bar};
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.2s ease;
`;

const DialogBox = styled.div`
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

const DialogTitle = styled.h3`
  margin: 0;
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
`;

const DialogMessage = styled.p`
  margin: 0;
  color: ${theme.colors.gray[300]};
  font-size: ${theme.fontSize.sm};
  line-height: 1.5;
`;

const WarningText = styled.p`
  margin: 0;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: ${theme.borderRadius.md};
  color: rgba(252, 165, 165, 0.9);
  font-size: ${theme.fontSize.xs};
  line-height: 1.4;
`;

const ErrorText = styled.div`
  font-size: ${theme.fontSize.xs};
  color: #ef4444;
  line-height: 1.4;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
`;

const DialogButton = styled.button<{ $destructive?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: 1px solid ${({ $destructive }) => $destructive ? 'transparent' : theme.colors.control.border};
  background: ${({ $destructive }) => $destructive ? 'rgba(239, 68, 68, 0.85)' : 'transparent'};
  color: ${({ $destructive }) => $destructive ? '#fff' : theme.colors.white};

  &:hover:not(:disabled) {
    background: ${({ $destructive }) => $destructive ? 'rgba(239, 68, 68, 1)' : theme.colors.control.backgroundHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface ConfirmDeleteDialogProps {
  name: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function ConfirmDeleteDialog({ name, onConfirm, onClose }: ConfirmDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch {
      setDeleting(false);
      setError('Failed to delete. Please try again.');
    }
  }, [deleting, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }, [onClose]);

  return createPortal(
    <Overlay onClick={deleting ? undefined : onClose} onKeyDown={handleKeyDown}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>Delete Playlist</DialogTitle>
        <DialogMessage>
          Are you sure you want to delete <strong>{name}</strong>?
        </DialogMessage>
        <WarningText>This action cannot be undone.</WarningText>
        {error && <ErrorText>{error}</ErrorText>}
        <ButtonRow>
          <DialogButton onClick={onClose} disabled={deleting}>
            Cancel
          </DialogButton>
          <DialogButton
            $destructive
            onClick={handleConfirm}
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </DialogButton>
        </ButtonRow>
      </DialogBox>
    </Overlay>,
    document.body,
  );
}
