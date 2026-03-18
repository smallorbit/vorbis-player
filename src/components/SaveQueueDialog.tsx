import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(4px);
  z-index: ${theme.zIndex.modal + 5};
  animation: ${fadeIn} 0.2s ease;
`;

const Dialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: ${theme.zIndex.modal + 6};
  width: min(380px, 90vw);
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius['2xl']};
  padding: ${theme.spacing.lg};
  animation: ${slideUp} 0.2s ease;
`;

const Title = styled.h3`
  color: ${theme.colors.white};
  margin: 0 0 ${theme.spacing.md};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
`;

const Input = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  outline: none;
  box-sizing: border-box;
  transition: border-color ${theme.transitions.fast};

  &:focus {
    border-color: rgba(255, 255, 255, 0.3);
  }

  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

const Warning = styled.div`
  margin-top: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(255, 180, 50, 0.12);
  border: 1px solid rgba(255, 180, 50, 0.25);
  border-radius: ${theme.borderRadius.md};
  color: rgba(255, 200, 100, 0.9);
  font-size: ${theme.fontSize.xs};
  line-height: 1.4;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.lg};
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.md};
  border: 1px solid ${props => props.$primary ? 'transparent' : theme.colors.popover.border};
  background: ${props => props.$primary ? 'rgba(255, 255, 255, 0.15)' : 'transparent'};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};

  &:hover:not(:disabled) {
    background: ${props => props.$primary ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)'};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

interface SaveQueueDialogProps {
  onSave: (name: string) => Promise<boolean>;
  onClose: () => void;
  hasSpotifyTracks: boolean;
  defaultName?: string;
}

export default function SaveQueueDialog({ onSave, onClose, hasSpotifyTracks, defaultName }: SaveQueueDialogProps) {
  const [name, setName] = useState(defaultName ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const success = await onSave(trimmed);
    setSaving(false);
    if (success) onClose();
  }, [name, saving, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSave, onClose]);

  return createPortal(
    <>
      <Overlay onClick={onClose} />
      <Dialog>
        <Title>Save Queue as Playlist</Title>
        <Input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Playlist name"
          maxLength={100}
          disabled={saving}
        />
        {hasSpotifyTracks && (
          <Warning>
            This queue contains Spotify tracks. They will be saved but require Spotify authentication to play back.
          </Warning>
        )}
        <ButtonRow>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button $primary onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </ButtonRow>
      </Dialog>
    </>,
    document.body,
  );
}
