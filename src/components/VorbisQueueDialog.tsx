import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';

export interface VorbisQueueDialogProps {
  isOpen: boolean;
  isResolving: boolean;
  removedCount: number | null;
  onKeepQueue: () => void;
  onStartFresh: () => void;
  onDismiss: () => void;
}

const Backdrop = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: ${theme.colors.overlay.light};
  z-index: ${theme.zIndex.overlay};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: opacity 200ms ease;
`;

const Card = styled.div<{ $isOpen: boolean }>`
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.popover};
  max-width: 380px;
  width: 90%;
  padding: ${theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
  transform: scale(${({ $isOpen }) => ($isOpen ? '1' : '0.95')});
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  transition: transform 200ms ease, opacity 200ms ease;
  z-index: ${theme.zIndex.modal};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${theme.fontSize.base};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.foreground};
`;

const Body = styled.p`
  margin: 0;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.muted.foreground};
  line-height: 1.5;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.sm};
`;

const BaseButton = styled.button`
  flex: 1;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(BaseButton)`
  background: ${theme.colors.accent};
  color: ${theme.colors.foregroundDark};

  &:hover:not(:disabled) {
    background: ${theme.colors.accentHover};
  }
`;

const SecondaryButton = styled(BaseButton)`
  background: ${theme.colors.control.background};
  color: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.border};

  &:hover:not(:disabled) {
    background: ${theme.colors.control.backgroundHover};
  }
`;

const LoadingText = styled.p`
  margin: 0;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.muted.foreground};
  text-align: center;
  padding: ${theme.spacing.sm} 0;
`;

function VorbisQueueDialogContent({
  isOpen,
  isResolving,
  removedCount,
  onKeepQueue,
  onStartFresh,
  onDismiss,
}: VorbisQueueDialogProps) {
  const isSummary = !isResolving && removedCount !== null;

  return (
    <Backdrop $isOpen={isOpen} role="dialog" aria-modal="true" aria-label="Provider switch options">
      <Card $isOpen={isOpen}>
        {isSummary ? (
          <>
            <Title>Queue Update</Title>
            <Body>
              {removedCount === 0
                ? 'All tracks resolved successfully.'
                : `${removedCount} track(s) not found on Spotify were removed from your queue.`}
            </Body>
            <ButtonRow>
              <PrimaryButton onClick={onDismiss}>Continue</PrimaryButton>
            </ButtonRow>
          </>
        ) : (
          <>
            <Title>Switch Provider</Title>
            <Body>
              Your radio queue contains tracks from both Dropbox and Spotify. If you switch
              providers, some Dropbox tracks may not be available on Spotify.
            </Body>
            {isResolving ? (
              <LoadingText>Resolving tracks…</LoadingText>
            ) : null}
            <ButtonRow>
              <SecondaryButton onClick={onStartFresh} disabled={isResolving}>
                Start fresh
              </SecondaryButton>
              <PrimaryButton onClick={onKeepQueue} disabled={isResolving}>
                Keep queue
              </PrimaryButton>
            </ButtonRow>
          </>
        )}
      </Card>
    </Backdrop>
  );
}

const VorbisQueueDialog = memo(function VorbisQueueDialog(props: VorbisQueueDialogProps) {
  if (!props.isOpen) return null;
  return createPortal(<VorbisQueueDialogContent {...props} />, document.body);
});

VorbisQueueDialog.displayName = 'VorbisQueueDialog';

export default VorbisQueueDialog;
