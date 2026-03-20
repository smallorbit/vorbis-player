import React, { memo, useRef, useEffect, useCallback, useState } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent, CardDescription } from '../components/styled';
import { ScrollArea } from '../components/styled';
import { Avatar } from '../components/styled';
import ProviderIcon from './ProviderIcon';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHorizontalSwipeToRemove } from '@/hooks/useHorizontalSwipeToRemove';

// Styled components
const QueueListRoot = styled.div`
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const QueueListCard = styled(Card)`
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

const QueueListCardHeader = styled(CardHeader)`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const QueueListCardHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const EditButton = styled.button`
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

const QueueListMeta = styled(CardDescription)`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[400]};
  margin: 0;
`;

const QueueListContent = styled(CardContent)`
  padding: 0;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const QueueListScroll = styled(ScrollArea)`
  flex: 1;
  min-height: 0;
`;

const QueueListItems = styled.div`
  padding: 1rem ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const QueueListItem = styled.div.withConfig({
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

const AlbumArtContainer = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const PlayIcon = styled.div`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay.light};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.white};
`;

const TrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const TrackName = styled.div.withConfig({
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

const TrackArtist = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
`;

const Duration = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-family: monospace;
  color: ${({ isSelected, theme }) => isSelected ? 'var(--accent-color)' : theme.colors.gray[400]};
  flex-shrink: 0;
`;

const DragHandle = styled.div`
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

const RemoveButton = styled.button`
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

const SwipeableWrapper = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

const SwipeableContent = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$offsetX', '$isSwiping'].includes(prop),
})<{ $offsetX: number; $isSwiping: boolean }>`
  transform: translateX(${({ $offsetX }) => $offsetX}px);
  transition: ${({ $isSwiping }) => $isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'};
  position: relative;
  z-index: 1;
`;

const SwipeRemoveBackdrop = styled.div`
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

// Drag handle grip icon (6 dots)
const GripIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="3" r="1.5" />
    <circle cx="11" cy="3" r="1.5" />
    <circle cx="5" cy="8" r="1.5" />
    <circle cx="11" cy="8" r="1.5" />
    <circle cx="5" cy="13" r="1.5" />
    <circle cx="11" cy="13" r="1.5" />
  </svg>
);

// Remove X icon
const RemoveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

interface QueueTrackListProps {
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onRemoveTrack?: (index: number) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  isOpen?: boolean;
  showProviderIcons?: boolean;
  canEdit?: boolean;
}

interface QueueItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onRemove?: (index: number) => void;
  itemRef?: React.RefObject<HTMLDivElement>;
  showProviderIcon?: boolean;
  isDragActive?: boolean;
  isEditMode?: boolean;
}

// Desktop queue item with sortable + hover remove
const SortableQueueItem = memo<QueueItemProps>(({
  track,
  index,
  isSelected,
  onSelect,
  onRemove,
  itemRef,
  showProviderIcon,
  isDragActive,
  isEditMode,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${track.name}-${track.id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const,
  };

  const handleClick = useCallback(() => {
    if (!isDragActive && !isEditMode) {
      onSelect(index);
    }
  }, [onSelect, index, isDragActive, isEditMode]);

  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(index);
  }, [onRemove, index]);

  return (
    <div ref={setNodeRef} style={style}>
      <QueueListItem
        ref={itemRef}
        onClick={handleClick}
        isSelected={isSelected}
      >
        {isEditMode && onRemove && (
          <DragHandle {...attributes} {...listeners}>
            <GripIcon />
          </DragHandle>
        )}

        <AlbumArtContainer>
          <Avatar
            src={track.image}
            alt={track.album}
            style={{ width: '3rem', height: '3rem' }}
            fallback={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
              </svg>
            }
          />
          {isSelected && (
            <PlayIcon>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </PlayIcon>
          )}
          {showProviderIcon && track.provider && (
            <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
              <ProviderIcon provider={track.provider} size={16} />
            </div>
          )}
        </AlbumArtContainer>

        <TrackInfo>
          <TrackName isSelected={isSelected}>
            {track.name}
          </TrackName>
          <TrackArtist isSelected={isSelected}>
            {track.artists}
          </TrackArtist>
        </TrackInfo>

        <Duration isSelected={isSelected}>
          {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
        </Duration>

        {isEditMode && onRemove && !isSelected && (
          <RemoveButton onClick={handleRemoveClick} aria-label={`Remove ${track.name}`}>
            <RemoveIcon />
          </RemoveButton>
        )}
      </QueueListItem>
    </div>
  );
});

// Mobile queue item with swipe-to-remove
const SwipeableQueueItem = memo<QueueItemProps>(({
  track,
  index,
  isSelected,
  onSelect,
  onRemove,
  itemRef,
  showProviderIcon,
  isEditMode,
}) => {
  const canRemove = isEditMode && onRemove && !isSelected;

  const handleRemove = useCallback(() => {
    onRemove?.(index);
  }, [onRemove, index]);

  const { ref: swipeRef, offsetX, isSwiping, isRevealed, reset } = useHorizontalSwipeToRemove({
    onRemove: handleRemove,
    enabled: !!canRemove,
  });

  const handleRemoveClick = useCallback(() => {
    reset();
    onRemove?.(index);
  }, [onRemove, index, reset]);

  if (!canRemove) {
    // No swipe for current track — render without swipe wrapper
    return (
      <QueueListItem
        ref={itemRef}
        onClick={() => {
          if (!isEditMode) onSelect(index);
        }}
        isSelected={isSelected}
      >
        <AlbumArtContainer>
          <Avatar
            src={track.image}
            alt={track.album}
            style={{ width: '3rem', height: '3rem' }}
            fallback={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
              </svg>
            }
          />
          {isSelected && (
            <PlayIcon>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </PlayIcon>
          )}
          {showProviderIcon && track.provider && (
            <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
              <ProviderIcon provider={track.provider} size={16} />
            </div>
          )}
        </AlbumArtContainer>

        <TrackInfo>
          <TrackName isSelected={isSelected}>
            {track.name}
          </TrackName>
          <TrackArtist isSelected={isSelected}>
            {track.artists}
          </TrackArtist>
        </TrackInfo>

        <Duration isSelected={isSelected}>
          {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
        </Duration>
      </QueueListItem>
    );
  }

  return (
    <SwipeableWrapper ref={swipeRef}>
      {(offsetX < 0 || isRevealed) && (
        <SwipeRemoveBackdrop>
          <button
            onClick={handleRemoveClick}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '8px 16px', font: 'inherit', fontWeight: 600 }}
            aria-label={`Remove ${track.name}`}
          >
            Remove
          </button>
        </SwipeRemoveBackdrop>
      )}
      <SwipeableContent $offsetX={offsetX} $isSwiping={isSwiping}>
        <QueueListItem
          ref={itemRef}
          onClick={() => !isRevealed && !isEditMode && onSelect(index)}
          isSelected={isSelected}
        >
          <AlbumArtContainer>
            <Avatar
              src={track.image}
              alt={track.album}
              style={{ width: '3rem', height: '3rem' }}
              fallback={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
                </svg>
              }
            />
            {showProviderIcon && track.provider && (
              <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
                <ProviderIcon provider={track.provider} size={16} />
              </div>
            )}
          </AlbumArtContainer>

          <TrackInfo>
            <TrackName isSelected={isSelected}>
              {track.name}
            </TrackName>
            <TrackArtist isSelected={isSelected}>
              {track.artists}
            </TrackArtist>
          </TrackInfo>

          <Duration isSelected={isSelected}>
            {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
          </Duration>
        </QueueListItem>
      </SwipeableContent>
    </SwipeableWrapper>
  );
});

// Detect touch device via media query
const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTouch;
};

const QueueTrackList = memo<QueueTrackListProps>(({
  tracks,
  currentTrackIndex,
  onTrackSelect,
  onRemoveTrack,
  onReorderTracks,
  isOpen = false,
  showProviderIcons = false,
  canEdit = false,
}) => {
  const currentTrackRef = useRef<HTMLDivElement>(null);
  const isTouch = useIsTouchDevice();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Auto-scroll to current track when queue opens
  useEffect(() => {
    if (isOpen && currentTrackRef.current && currentTrackIndex >= 0) {
      const timeoutId = setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, currentTrackIndex]);

  // Reset edit mode when drawer closes
  useEffect(() => {
    if (!isOpen) setIsEditMode(false);
  }, [isOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const sortableIds = tracks.map(t => `${t.name}-${t.id}`);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    setIsDragActive(true);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setIsDragActive(false);
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderTracks) return;

    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderTracks(oldIndex, newIndex);
    }
  }, [sortableIds, onReorderTracks]);

  const canManageQueue = !!(onRemoveTrack || onReorderTracks);

  const editButton = canEdit && canManageQueue ? (
    <EditButton onClick={() => setIsEditMode(m => !m)}>
      {isEditMode ? 'Done' : 'Edit'}
    </EditButton>
  ) : null;

  // On touch devices without reorder support, use swipeable items
  if (isTouch && !onReorderTracks) {
    return (
      <QueueListRoot>
        <QueueListCard>
          <QueueListCardHeader>
            <QueueListCardHeaderRow>
              <QueueListMeta>{tracks.length} tracks</QueueListMeta>
              {editButton}
            </QueueListCardHeaderRow>
          </QueueListCardHeader>
          <QueueListContent>
            <QueueListScroll>
              <QueueListItems>
                {tracks.map((track, index) => (
                  <SwipeableQueueItem
                    key={`${track.name}-${track.id}`}
                    track={track}
                    index={index}
                    isSelected={index === currentTrackIndex}
                    onSelect={onTrackSelect}
                    onRemove={onRemoveTrack}
                    itemRef={index === currentTrackIndex ? currentTrackRef : undefined}
                    showProviderIcon={showProviderIcons}
                    isEditMode={isEditMode}
                  />
                ))}
              </QueueListItems>
            </QueueListScroll>
          </QueueListContent>
        </QueueListCard>
      </QueueListRoot>
    );
  }

  // Desktop / with reorder: use DnD context
  if (canManageQueue) {
    return (
      <QueueListRoot>
        <QueueListCard>
          <QueueListCardHeader>
            <QueueListCardHeaderRow>
              <QueueListMeta>{tracks.length} tracks</QueueListMeta>
              {editButton}
            </QueueListCardHeaderRow>
          </QueueListCardHeader>
          <QueueListContent>
            <QueueListScroll>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <QueueListItems>
                    {tracks.map((track, index) => (
                      <SortableQueueItem
                        key={`${track.name}-${track.id}`}
                        track={track}
                        index={index}
                        isSelected={index === currentTrackIndex}
                        onSelect={onTrackSelect}
                        onRemove={onRemoveTrack}
                        itemRef={index === currentTrackIndex ? currentTrackRef : undefined}
                        showProviderIcon={showProviderIcons}
                        isDragActive={isDragActive}
                        isEditMode={isEditMode}
                      />
                    ))}
                  </QueueListItems>
                </SortableContext>
              </DndContext>
            </QueueListScroll>
          </QueueListContent>
        </QueueListCard>
      </QueueListRoot>
    );
  }

  // Fallback: no queue management (read-only)
  return (
    <QueueListRoot>
      <QueueListCard>
        <QueueListCardHeader>
          <QueueListMeta>{tracks.length} tracks</QueueListMeta>
        </QueueListCardHeader>
        <QueueListContent>
          <QueueListScroll>
            <QueueListItems>
              {tracks.map((track: Track, index: number) => (
                <QueueListItem
                  key={`${track.name}-${track.id}`}
                  ref={index === currentTrackIndex ? currentTrackRef : undefined}
                  onClick={() => onTrackSelect(index)}
                  isSelected={index === currentTrackIndex}
                >
                  <AlbumArtContainer>
                    <Avatar
                      src={track.image}
                      alt={track.album}
                      style={{ width: '3rem', height: '3rem' }}
                      fallback={
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
                        </svg>
                      }
                    />
                    {index === currentTrackIndex && (
                      <PlayIcon>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </PlayIcon>
                    )}
                    {showProviderIcons && track.provider && (
                      <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
                        <ProviderIcon provider={track.provider} size={16} />
                      </div>
                    )}
                  </AlbumArtContainer>

                  <TrackInfo>
                    <TrackName isSelected={index === currentTrackIndex}>
                      {track.name}
                    </TrackName>
                    <TrackArtist isSelected={index === currentTrackIndex}>
                      {track.artists}
                    </TrackArtist>
                  </TrackInfo>

                  <Duration isSelected={index === currentTrackIndex}>
                    {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)}:${Math.floor((track.duration_ms % 60000) / 1000).toString().padStart(2, '0')}` : '--:--'}
                  </Duration>
                </QueueListItem>
              ))}
            </QueueListItems>
          </QueueListScroll>
        </QueueListContent>
      </QueueListCard>
    </QueueListRoot>
  );
});

export default QueueTrackList;
