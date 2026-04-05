import styled from 'styled-components';
import { Card, CardHeader, CardContent, CardDescription } from '../components/styled';
import { ScrollArea } from '../components/styled';

export const QueueListRoot = styled.div`
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export const QueueListCard = styled(Card)`
  background: ${({ theme }) => theme.colors.muted.background};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  border-radius: 1.25rem;
  overflow: hidden;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

export const QueueListCardHeader = styled(CardHeader)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

export const QueueListCardHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const EditButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.gray[400]};
  cursor: pointer;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  transition: color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.white};
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }
`;

export const QueueListMeta = styled(CardDescription)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[400]};
  margin: 0;
`;

export const QueueListContent = styled(CardContent)`
  padding: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export const QueueListScroll = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
`;

export const QueueListItems = styled.div`
  padding: 1rem ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const QueueListItem = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  border: 1px solid transparent;

  ${({ theme, isSelected }) => isSelected ? `
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    border-color: var(--accent-color);
  ` : `
    &:hover {
      background: ${theme.colors.control.backgroundHover};
    }
  `}
`;

export const AlbumArtContainer = styled.div`
  position: relative;
  flex-shrink: 0;
`;

export const PlayIcon = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay.light};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.white};
`;

export const TrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const TrackName = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: 1.25;
  color: ${({ isSelected, theme }) => isSelected ? theme.colors.white : '#f5f5f5'};

  /* Allow up to 2 lines with ellipsis on overflow */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;

export const TrackArtist = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
`;

export const Duration = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
  flex-shrink: 0;
`;

export const DragHandle = styled.div`
  flex-shrink: 0;
  cursor: grab;
  color: ${({ theme }) => theme.colors.gray[500]};
  display: flex;
  align-items: center;
  padding: 0 2px;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

export const RemoveButton = styled.button`
  flex-shrink: 0;
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.gray[500]};
  cursor: pointer;
  padding: 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;

  ${QueueListItem}:hover & {
    opacity: 1;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.error};
    background: ${({ theme }) => `color-mix(in srgb, ${theme.colors.error} 15%, transparent)`};
  }
`;

export const SwipeableWrapper = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

export const SwipeableContent = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$offsetX', '$isSwiping'].includes(prop),
})<{ $offsetX: number; $isSwiping: boolean }>`
  transform: translateX(${({ $offsetX }) => $offsetX}px);
  transition: ${({ $isSwiping }) => $isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'};
  position: relative;
  z-index: 1;
`;

export const SwipeRemoveBackdrop = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 80px;
  background: ${({ theme }) => theme.colors.error};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  border-radius: 0 ${({ theme }) => theme.borderRadius.lg} ${({ theme }) => theme.borderRadius.lg} 0;
`;

export const SwipeRemoveButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 8px 16px;
  font-family: inherit;
  font-weight: 600;
`;

export const ProviderIconContainer = styled.div`
  position: absolute;
  bottom: -2px;
  right: -2px;
  z-index: 2;
`;


export const RadioSeedDescription = styled.div`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin-top: 2px;
`;

export const LoadingFallback = styled.div`
  animation: ${({ theme }) => theme.animations.pulse};
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-align: center;
`;
