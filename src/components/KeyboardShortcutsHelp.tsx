import React, { memo } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ShortcutItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} 0;
`;

const ShortcutDescription = styled.span`
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const ShortcutKey = styled.kbd`
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.xs}`};
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.foreground};
  min-width: 1.75rem;
  text-align: center;
`;

const shortcuts = [
  { key: 'Space', description: 'Play / Pause' },
  { key: '←', description: 'Previous track' },
  { key: '→', description: 'Next track' },
  { key: '↑ / Q', description: 'Toggle queue' },
  { key: '↓ / L', description: 'Toggle library' },
  { key: 'K', description: 'Like / Unlike track' },
  { key: 'M', description: 'Mute / Unmute' },
  { key: 'G', description: 'Toggle glow effect' },
  { key: 'V', description: 'Toggle background visualizations' },
  { key: 'S', description: 'Toggle shuffle' },
  { key: 'Shift+S', description: 'Open settings' },
  { key: 'Z', description: 'Toggle zen mode' },
  { key: 'Esc', description: 'Close menus' },
  { key: '/', description: 'Show this help' },
];

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = memo(({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <ShortcutList>
          {shortcuts.map(({ key, description }) => (
            <ShortcutItem key={key}>
              <ShortcutDescription>{description}</ShortcutDescription>
              <ShortcutKey>{key}</ShortcutKey>
            </ShortcutItem>
          ))}
        </ShortcutList>
      </DialogContent>
    </Dialog>
  );
});

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';

export default KeyboardShortcutsHelp;
