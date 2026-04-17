import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import {
  DialogOverlay,
  DialogBox,
  DialogTitle,
  DialogErrorText,
  DialogButtonRow,
  DialogButton,
} from './styled/Dialog';

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
  border-radius: ${theme.borderRadius.flat};
  color: rgba(252, 165, 165, 0.9);
  font-size: ${theme.fontSize.xs};
  line-height: 1.4;
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
    <DialogOverlay onClick={deleting ? undefined : onClose} onKeyDown={handleKeyDown}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>Delete Playlist</DialogTitle>
        <DialogMessage>
          Are you sure you want to delete <strong>{name}</strong>?
        </DialogMessage>
        <WarningText>This action cannot be undone.</WarningText>
        {error && <DialogErrorText>{error}</DialogErrorText>}
        <DialogButtonRow>
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
        </DialogButtonRow>
      </DialogBox>
    </DialogOverlay>,
    document.body,
  );
}
