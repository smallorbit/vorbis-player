import { memo } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { SaveQueueButton, SaveQueueIcon } from './QueueSaveControl';

const HeaderRoot = styled.div<{ $variant: 'drawer' | 'sheet' }>`
  display: flex;
  flex-direction: ${({ $variant }) => ($variant === 'sheet' ? 'column' : 'row')};
  justify-content: space-between;
  align-items: ${({ $variant }) => ($variant === 'sheet' ? 'stretch' : 'center')};
  margin-bottom: ${({ $variant }) => ($variant === 'drawer' ? theme.spacing.md : 0)};
  padding-bottom: ${({ $variant }) => ($variant === 'drawer' ? theme.spacing.md : 0)};
  border-bottom: ${({ $variant }) =>
    $variant === 'drawer' ? `1px solid ${theme.colors.popover.border}` : 'none'};
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
`;

const Title = styled.h3<{ $variant: 'drawer' | 'sheet' }>`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
  padding: ${({ $variant }) => ($variant === 'sheet' ? `0 ${theme.spacing.lg} ${theme.spacing.md}` : 0)};
`;

const Subtitle = styled.div<{ $variant: 'drawer' | 'sheet' }>`
  font-size: ${({ $variant }) => ($variant === 'sheet' ? '0.75rem' : theme.fontSize.xs)};
  color: ${({ $variant }) =>
    $variant === 'sheet' ? 'rgba(255,255,255,0.5)' : theme.colors.muted.foreground};
  margin-top: 2px;
  text-align: ${({ $variant }) => ($variant === 'sheet' ? 'center' : 'left')};
`;

const HeaderActions = styled.div<{ $variant: 'drawer' | 'sheet' }>`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: ${({ $variant }) => ($variant === 'sheet' ? `0 ${theme.spacing.lg} ${theme.spacing.md}` : 0)};
  justify-content: ${({ $variant }) => ($variant === 'sheet' ? 'space-between' : 'flex-end')};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xl};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

export interface QueueShellHeaderProps {
  variant: 'drawer' | 'sheet';
  radioActive?: boolean | undefined;
  radioSeedDescription?: string | undefined;
  canSaveQueue?: boolean | undefined;
  onSaveQueue?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
}

export const QueueShellHeader = memo(function QueueShellHeader({
  variant,
  radioActive,
  radioSeedDescription,
  canSaveQueue,
  onSaveQueue,
  onClose,
  closeLabel = 'Close Up Next drawer',
}: QueueShellHeaderProps) {
  const title = radioActive ? 'Radio' : 'Up Next';

  if (variant === 'sheet') {
    return (
      <>
        <HeaderActions $variant="sheet">
          <Title $variant="sheet" className="noPadding">
            {title}
          </Title>
          {canSaveQueue && (
            <SaveQueueButton onClick={onSaveQueue} title="Save as playlist" aria-label="Save as playlist">
              <SaveQueueIcon />
            </SaveQueueButton>
          )}
        </HeaderActions>
        {radioActive && radioSeedDescription && (
          <Subtitle $variant="sheet">{radioSeedDescription}</Subtitle>
        )}
      </>
    );
  }

  return (
    <HeaderRoot $variant="drawer">
      <TitleBlock>
        <Title $variant="drawer">{title}</Title>
        {radioActive && radioSeedDescription && (
          <Subtitle $variant="drawer">{radioSeedDescription}</Subtitle>
        )}
      </TitleBlock>
      <HeaderActions $variant="drawer">
        {canSaveQueue && (
          <SaveQueueButton onClick={onSaveQueue} title="Save as playlist" aria-label="Save as playlist">
            <SaveQueueIcon />
          </SaveQueueButton>
        )}
        {onClose && (
          <CloseButton onClick={onClose} aria-label={closeLabel}>
            ×
          </CloseButton>
        )}
      </HeaderActions>
    </HeaderRoot>
  );
});
