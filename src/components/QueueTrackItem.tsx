import React, { memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaTrack } from '@/types/domain';
import { formatDuration } from '@/utils/formatDuration';
import { Avatar } from '../components/styled';
import ProviderIcon from './ProviderIcon';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHorizontalSwipeToRemove } from '@/hooks/useHorizontalSwipeToRemove';
import { useLongPress } from '@/hooks/useLongPress';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import TrackInfoPopover, {
  PlayIcon as PopoverPlayIcon,
  AddToLibraryIcon,
  RemoveFromLibraryIcon,
  TrashIcon,
} from './controls/TrackInfoPopover';
import {
  QueueListItem,
  AlbumArtContainer,
  PlayIcon,
  TrackInfo,
  TrackName,
  TrackArtist,
  Duration,
  DragHandle,
  RemoveButton,
  SwipeableWrapper,
  SwipeableContent,
  SwipeRemoveBackdrop,
} from './QueueTrackList.styled';

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

const RemoveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const AlbumFallbackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" fill="currentColor"/>
  </svg>
);

const PlayingIcon = () => (
  <PlayIcon>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  </PlayIcon>
);

export interface QueueItemProps {
  track: MediaTrack;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onRemove?: (index: number) => void;
  itemRef?: React.RefObject<HTMLDivElement>;
  showProviderIcon?: boolean;
  isDragActive?: boolean;
  isEditMode?: boolean;
}

interface ContextMenuState {
  anchorRect: DOMRect;
}

function useQueueItemContextMenu(
  track: MediaTrack,
  index: number,
  isSelected: boolean,
  onSelect: (index: number) => void,
  onRemove?: (index: number) => void,
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const { isLiked, isLikePending, handleLikeToggle, canSaveTrack } = useLikeTrack(
    track.id,
    track.provider,
  );

  const openContextMenu = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();

    let rect: DOMRect;
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      rect = new DOMRect(touch.clientX, touch.clientY, 0, 0);
    } else {
      rect = new DOMRect((event as React.MouseEvent).clientX, (event as React.MouseEvent).clientY, 0, 0);
    }
    setContextMenu({ anchorRect: rect });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const buildOptions = useCallback(() => {
    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [
      {
        label: 'Play now',
        icon: React.createElement(PopoverPlayIcon),
        onClick: () => onSelect(index),
      },
    ];

    if (canSaveTrack) {
      options.push({
        label: isLiked ? 'Unlike' : 'Like',
        icon: isLiked
          ? React.createElement(RemoveFromLibraryIcon)
          : React.createElement(AddToLibraryIcon),
        onClick: handleLikeToggle,
      });
    }

    if (onRemove && !isSelected) {
      options.push({
        label: 'Remove from queue',
        icon: React.createElement(TrashIcon),
        onClick: () => onRemove(index),
      });
    }

    return options;
  }, [index, isLiked, isLikePending, canSaveTrack, handleLikeToggle, onSelect, onRemove, isSelected]);

  return { contextMenu, openContextMenu, closeContextMenu, buildOptions };
}

function TrackArtAndInfo({
  track,
  isSelected,
  showProviderIcon,
}: {
  track: MediaTrack;
  isSelected: boolean;
  showProviderIcon?: boolean;
}) {
  return (
    <>
      <AlbumArtContainer>
        <Avatar
          src={track.image}
          alt={track.album}
          style={{ width: '3rem', height: '3rem' }}
          fallback={<AlbumFallbackIcon />}
        />
        {isSelected && <PlayingIcon />}
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
        {track.durationMs ? formatDuration(track.durationMs) : '--:--'}
      </Duration>
    </>
  );
}

export const SortableQueueItem = memo<QueueItemProps>(({
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

  const { contextMenu, openContextMenu, closeContextMenu, buildOptions } = useQueueItemContextMenu(
    track, index, isSelected, onSelect, onRemove,
  );

  const { onTouchStart, onTouchEnd, onTouchMove } = useLongPress({ onLongPress: openContextMenu });

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
        onContextMenu={openContextMenu}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        isSelected={isSelected}
      >
        {isEditMode && onRemove && (
          <DragHandle {...attributes} {...listeners}>
            <GripIcon />
          </DragHandle>
        )}

        <TrackArtAndInfo track={track} isSelected={isSelected} showProviderIcon={showProviderIcon} />

        {isEditMode && onRemove && !isSelected && (
          <RemoveButton onClick={handleRemoveClick} aria-label={`Remove ${track.name}`}>
            <RemoveIcon />
          </RemoveButton>
        )}
      </QueueListItem>

      {contextMenu && createPortal(
        <TrackInfoPopover
          type="album"
          anchorRect={contextMenu.anchorRect}
          onClose={closeContextMenu}
          options={buildOptions()}
        />,
        document.body,
      )}
    </div>
  );
});

export const SwipeableQueueItem = memo<QueueItemProps>(({
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

  const { contextMenu, openContextMenu, closeContextMenu, buildOptions } = useQueueItemContextMenu(
    track, index, isSelected, onSelect, onRemove,
  );

  const longPressHandlers = useLongPress({ onLongPress: openContextMenu });

  if (!canRemove) {
    return (
      <>
        <QueueListItem
          ref={itemRef}
          onClick={() => {
            if (!isEditMode) onSelect(index);
          }}
          onContextMenu={openContextMenu}
          {...longPressHandlers}
          isSelected={isSelected}
        >
          <TrackArtAndInfo track={track} isSelected={isSelected} showProviderIcon={showProviderIcon} />
        </QueueListItem>

        {contextMenu && createPortal(
          <TrackInfoPopover
            type="album"
            anchorRect={contextMenu.anchorRect}
            onClose={closeContextMenu}
            options={buildOptions()}
          />,
          document.body,
        )}
      </>
    );
  }

  return (
    <>
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
            onContextMenu={openContextMenu}
            {...longPressHandlers}
            isSelected={isSelected}
          >
            <AlbumArtContainer>
              <Avatar
                src={track.image}
                alt={track.album}
                style={{ width: '3rem', height: '3rem' }}
                fallback={<AlbumFallbackIcon />}
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
              {track.durationMs ? formatDuration(track.durationMs) : '--:--'}
            </Duration>
          </QueueListItem>
        </SwipeableContent>
      </SwipeableWrapper>

      {contextMenu && createPortal(
        <TrackInfoPopover
          type="album"
          anchorRect={contextMenu.anchorRect}
          onClose={closeContextMenu}
          options={buildOptions()}
        />,
        document.body,
      )}
    </>
  );
});
