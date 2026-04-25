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
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Disconnect {providerName}</DialogTitle>
        </DialogHeader>
        <DialogMessage>
          Are you sure you want to disconnect <strong>{providerName}</strong>?
        </DialogMessage>
        {affectedQueueCount != null && affectedQueueCount > 0 && (
          <WarningText>
            Disconnecting will stop playback and remove {affectedQueueCount} queued{' '}
            {affectedQueueCount === 1 ? 'track' : 'tracks'}.
          </WarningText>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} autoFocus>
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
