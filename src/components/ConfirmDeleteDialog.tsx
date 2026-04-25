import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !deleting) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Delete Playlist</DialogTitle>
        </DialogHeader>
        <DialogMessage>
          Are you sure you want to delete <strong>{name}</strong>?
        </DialogMessage>
        <WarningText>This action cannot be undone.</WarningText>
        {error && <ErrorText>{error}</ErrorText>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
