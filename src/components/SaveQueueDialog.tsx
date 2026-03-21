/**
 * Inline dialog for saving the current queue as a playlist.
 * Supports saving to Dropbox (as JSON file) or Spotify (as playlist via API).
 * Shows a provider selector when multiple providers are available.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';
import type { ProviderId } from '@/types/domain';

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
    border-color: rgba(255, 255, 255, 0.5);
  }

  &::placeholder {
    color: ${theme.colors.gray[500]};
  }
`;

const Warning = styled.div`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(255, 180, 50, 0.12);
  border: 1px solid rgba(255, 180, 50, 0.25);
  border-radius: ${theme.borderRadius.md};
  color: rgba(255, 200, 100, 0.9);
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

const DialogButton = styled.button<{ $primary?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: 1px solid ${({ $primary }) => $primary ? 'transparent' : theme.colors.control.border};
  background: ${({ $primary }) => $primary ? 'rgba(255, 255, 255, 0.9)' : 'transparent'};
  color: ${({ $primary }) => $primary ? '#111' : theme.colors.white};

  &:hover:not(:disabled) {
    background: ${({ $primary }) => $primary ? 'rgba(255, 255, 255, 1)' : theme.colors.control.backgroundHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ProviderRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
`;

const ProviderOption = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: 1px solid ${({ $active }) => $active ? 'rgba(255, 255, 255, 0.5)' : theme.colors.control.border};
  background: ${({ $active }) => $active ? 'rgba(255, 255, 255, 0.12)' : 'transparent'};
  color: ${({ $active }) => $active ? theme.colors.white : theme.colors.gray[400]};

  &:hover {
    background: ${({ $active }) => $active ? 'rgba(255, 255, 255, 0.15)' : theme.colors.control.backgroundHover};
  }
`;

const PROVIDER_LABELS: Record<string, string> = {
  dropbox: 'Dropbox',
  spotify: 'Spotify',
};

interface SaveQueueDialogProps {
  onSave: (name: string, provider: ProviderId) => Promise<boolean>;
  onClose: () => void;
  availableProviders: ProviderId[];
  hasDropboxTracks: boolean;
  hasSpotifyTracks: boolean;
  defaultName?: string;
}

export default function SaveQueueDialog({ onSave, onClose, availableProviders, hasDropboxTracks, hasSpotifyTracks, defaultName }: SaveQueueDialogProps) {
  const [name, setName] = useState(() => {
    if (defaultName) return defaultName;
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Queue — ${date}`;
  });
  const [provider, setProvider] = useState<ProviderId>(availableProviders[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setError(null);
    setSaving(true);
    const success = await onSave(trimmed, provider);
    setSaving(false);
    if (!success) {
      setError('Failed to save playlist. Please try again.');
    }
  }, [name, saving, onSave, provider]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }, [handleSave, onClose]);

  const showProviderSelector = availableProviders.length > 1;
  const showDropboxWarning = provider === 'dropbox' && hasSpotifyTracks;
  const showSpotifyWarning = provider === 'spotify' && hasDropboxTracks;

  return createPortal(
    <Overlay onClick={saving ? undefined : onClose} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>Save Queue as Playlist</DialogTitle>
        {showProviderSelector && (
          <ProviderRow>
            {availableProviders.map(id => (
              <ProviderOption
                key={id}
                $active={provider === id}
                onClick={() => setProvider(id)}
                disabled={saving}
              >
                {PROVIDER_LABELS[id] ?? id}
              </ProviderOption>
            ))}
          </ProviderRow>
        )}
        <Input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Playlist name"
          disabled={saving}
          autoFocus
        />
        {showDropboxWarning && (
          <Warning>
            This queue contains Spotify tracks. They will be saved but require Spotify authentication to play back.
          </Warning>
        )}
        {showSpotifyWarning && (
          <Warning>
            This queue contains Dropbox tracks. Only tracks that can be matched on Spotify will be included.
          </Warning>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <ButtonRow>
          <DialogButton onClick={onClose} disabled={saving}>
            Cancel
          </DialogButton>
          <DialogButton
            $primary
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </DialogButton>
        </ButtonRow>
      </DialogBox>
    </Overlay>,
    document.body,
  );
}
