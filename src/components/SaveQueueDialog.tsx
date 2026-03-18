/**
 * Inline dialog for saving the current queue as a Spotify playlist.
 * Renders as a portal overlay with a name input and save button.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';
import type { SaveQueueStatus } from '@/hooks/useSaveQueueAsPlaylist';

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

const Input = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.lg};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.base};
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: var(--accent-color);
  }

  &::placeholder {
    color: ${theme.colors.gray[500]};
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
`;

const DialogButton = styled.button<{ $primary?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: 1px solid ${({ $primary }) => $primary ? 'transparent' : theme.colors.control.border};
  background: ${({ $primary }) => $primary ? 'var(--accent-color)' : 'transparent'};
  color: ${theme.colors.white};

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusText = styled.div<{ $error?: boolean }>`
  font-size: ${theme.fontSize.sm};
  color: ${({ $error }) => $error ? '#ef4444' : theme.colors.gray[400]};
`;

interface SaveQueueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  status: SaveQueueStatus;
  error: string | null;
  trackCount: number;
}

export default function SaveQueueDialog({
  isOpen,
  onClose,
  onSave,
  status,
  error,
  trackCount,
}: SaveQueueDialogProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setName(`Queue — ${date}`);
      // Focus after portal renders
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [isOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && status !== 'saving') {
      onSave(trimmed);
    }
  }, [name, status, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const isSaving = status === 'saving';

  return createPortal(
    <Overlay onClick={isSaving ? undefined : onClose} onKeyDown={handleKeyDown}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>Save Queue to Spotify</DialogTitle>
        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Playlist name"
            disabled={isSaving}
            autoFocus
          />
        </form>
        <StatusText>
          {trackCount} track{trackCount !== 1 ? 's' : ''} in queue
        </StatusText>
        {error && <StatusText $error>{error}</StatusText>}
        <ButtonRow>
          <DialogButton onClick={onClose} disabled={isSaving}>
            Cancel
          </DialogButton>
          <DialogButton
            $primary
            onClick={() => {
              const trimmed = name.trim();
              if (trimmed) onSave(trimmed);
            }}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </DialogButton>
        </ButtonRow>
      </DialogBox>
    </Overlay>,
    document.body,
  );
}
