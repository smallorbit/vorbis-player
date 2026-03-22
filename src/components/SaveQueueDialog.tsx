/**
 * Inline dialog for saving the current queue as a playlist.
 * Supports saving to any provider that implements savePlaylist.
 * Shows a provider selector when multiple providers are available.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import type { ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import {
  DialogOverlay,
  DialogBox,
  DialogTitle,
  DialogErrorText,
  DialogButtonRow,
  DialogButton,
} from './styled/Dialog';

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

interface SaveQueueDialogProps {
  onSave: (name: string, provider: ProviderId) => Promise<boolean>;
  onClose: () => void;
  availableProviders: ProviderId[];
  trackProviders: Set<string | undefined>;
  defaultName?: string;
}

export default function SaveQueueDialog({ onSave, onClose, availableProviders, trackProviders, defaultName }: SaveQueueDialogProps) {
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
  const targetDescriptor = providerRegistry.get(provider);
  const hasOtherProviderTracks = Array.from(trackProviders).some(p => p && p !== provider);

  return createPortal(
    <DialogOverlay onClick={saving ? undefined : onClose} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <DialogBox onClick={e => e.stopPropagation()}>
        <DialogTitle>Save Queue as Playlist</DialogTitle>
        {showProviderSelector && (
          <ProviderRow>
            {availableProviders.map(id => {
              const desc = providerRegistry.get(id);
              return (
                <ProviderOption
                  key={id}
                  $active={provider === id}
                  onClick={() => setProvider(id)}
                  disabled={saving}
                >
                  {desc?.name ?? id}
                </ProviderOption>
              );
            })}
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
        {hasOtherProviderTracks && (
          <Warning>
            This queue contains tracks from other providers. Some tracks may be skipped or require additional authentication when saving to {targetDescriptor?.name ?? provider}.
          </Warning>
        )}
        {error && <DialogErrorText>{error}</DialogErrorText>}
        <DialogButtonRow>
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
        </DialogButtonRow>
      </DialogBox>
    </DialogOverlay>,
    document.body,
  );
}
