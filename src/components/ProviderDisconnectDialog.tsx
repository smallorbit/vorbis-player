import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import {
  DialogOverlay,
  DialogBox,
  DialogTitle,
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
  border-radius: ${theme.borderRadius.md};
  color: rgba(252, 165, 165, 0.9);
  font-size: ${theme.fontSize.xs};
  line-height: 1.4;
`;

interface ProviderDisconnectDialogProps {
  providerName: string;
  affectedQueueCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProviderDisconnectDialog({
  providerName,
  affectedQueueCount,
  onConfirm,
  onCancel,
}: ProviderDisconnectDialogProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    },
    [onCancel],
  );

  return createPortal(
    <DialogOverlay onClick={onCancel} onKeyDown={handleKeyDown}>
      <DialogBox
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-disconnect-title"
        onClick={e => e.stopPropagation()}
      >
        <DialogTitle id="provider-disconnect-title">Disconnect {providerName}</DialogTitle>
        <DialogMessage>
          Are you sure you want to disconnect <strong>{providerName}</strong>?
        </DialogMessage>
        {affectedQueueCount != null && affectedQueueCount > 0 && (
          <WarningText>
            Disconnecting will stop playback and remove {affectedQueueCount} queued{' '}
            {affectedQueueCount === 1 ? 'track' : 'tracks'}.
          </WarningText>
        )}
        <DialogButtonRow>
          <DialogButton onClick={onCancel}>Cancel</DialogButton>
          <DialogButton $destructive onClick={onConfirm} autoFocus>
            Disconnect
          </DialogButton>
        </DialogButtonRow>
      </DialogBox>
    </DialogOverlay>,
    document.body,
  );
}
