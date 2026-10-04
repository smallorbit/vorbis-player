import React, { memo, useCallback, useRef, useState } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHorizontalSwipeToRemove } from '@/hooks/useHorizontalSwipeToRemove';
import { useLongPress } from '@/hooks/useLongPress';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { QueueContextMenu } from './QueueContextMenu';
import { QueueTrackRowBody } from './QueueTrackRowBody';
import { CloseIcon, GripIcon, TrashIcon } from '@/components/icons/ActionIcons';
import { StrokeHeartIcon } from '@/components/icons/HeartIcons';
import { PlayIcon } from '@/components/icons/PlaybackIcons';
import {
  QueueListItem,
  DragHandle,
  RemoveButton,
  SwipeableWrapper,
  SwipeableContent,
  SwipeRemoveBackdrop,
} from './QueueTrackList.styled';

const DRAG_ACTIVE_Z = 10;

interface ContextMenuState {
  x: number;
  y: number;
}

interface QueueItemProps {
  track: MediaTrack;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onRemove?: ((index: number) => void) | undefined;
  onPlayNext?: ((index: number) => void) | undefined;
  itemRef?: React.RefObject<HTMLDivElement> | undefined;
  showProviderIcon?: boolean | undefined;
  isDragActive?: boolean | undefined;
  isEditMode?: boolean | undefined;
}

function useQueueItemContextMenu(
  track: MediaTrack,
  index: number,
  isSelected: boolean,
  onRemove?: (index: number) => void,
  onPlayNext?: (index: number) => void,
) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const { isLiked, handleLikeToggle, canSaveTrack } = useLikeTrack(track.id, track.provider);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  const closeMenu = useCallback(() => setMenu(null), []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const onLongPress = useCallback(() => {
    setMenu({ x: pointerPosRef.current.x, y: pointerPosRef.current.y });
  }, []);

  const baseLongPressHandlers = useLongPress({ onLongPress, enabled: true });

  const longPressHandlers = {
    ...baseLongPressHandlers,
    onPointerDown: useCallback(
      (e: React.PointerEvent) => {
        pointerPosRef.current = { x: e.clientX, y: e.clientY };
        baseLongPressHandlers.onPointerDown(e);
      },
      [baseLongPressHandlers],
    ),
  };

  const options = [
    {
      label: 'Play next',
      icon: <PlayIcon size={16} />,
      onClick: () => onPlayNext?.(index),
    },
    ...(canSaveTrack
      ? [{ label: isLiked ? 'Unlike' : 'Like', icon: <StrokeHeartIcon filled={isLiked} size={16} />, onClick: handleLikeToggle }]
      : []),
    ...(!isSelected && onRemove
      ? [{ label: 'Remove from queue', icon: <TrashIcon />, onClick: () => onRemove(index), destructive: true }]
      : []),
  ];

  return { menu, closeMenu, handleContextMenu, longPressHandlers, options };
}

function QueueRowMenu(props: { menu: ContextMenuState; options: ReturnType<typeof useQueueItemContextMenu>['options']; closeMenu: () => void }) {
  const { menu, options, closeMenu } = props;
  return (
    <QueueContextMenu x={menu.x} y={menu.y} options={options} onClose={closeMenu} />
  );
}

function QueueItemRowChrome({
  track,
  isSelected,
  showProviderIcon,
  showPlayingIndicator,
  children,
}: {
  track: MediaTrack;
  isSelected: boolean;
  showProviderIcon?: boolean | undefined;
  showPlayingIndicator?: boolean | undefined;
  children?: React.ReactNode;
}) {
  return (
    <>
      <QueueTrackRowBody
        track={track}
        isSelected={isSelected}
        showProviderIcon={showProviderIcon}
        showPlayingIndicator={showPlayingIndicator}
      />
      {children}
    </>
  );
}

export const SortableQueueItem = memo<QueueItemProps>(({
  track,
  index,
  isSelected,
  onSelect,
  onRemove,
  onPlayNext,
  itemRef,
  showProviderIcon,
  isDragActive,
  isEditMode,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? DRAG_ACTIVE_Z : undefined,
    position: 'relative' as const,
  };

  const handleClick = useCallback(() => {
    if (!isDragActive && !isEditMode) {
      onSelect(index);
    }
  }, [onSelect, index, isDragActive, isEditMode]);

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(index);
    },
    [onRemove, index],
  );

  const { menu, closeMenu, handleContextMenu, longPressHandlers, options } = useQueueItemContextMenu(
    track,
    index,
    isSelected,
    onRemove,
    onPlayNext,
  );

  return (
    <div ref={setNodeRef} style={style}>
      <QueueListItem
        ref={itemRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        data-testid="queue-track-row"
        $isSelected={isSelected}
        {...longPressHandlers}
        {...(isEditMode && onRemove ? { ...attributes, ...listeners } : {})}
        style={
          isEditMode && onRemove
            ? { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }
            : undefined
        }
      >
        {isEditMode && onRemove && (
          <DragHandle>
            <GripIcon />
          </DragHandle>
        )}
        <QueueItemRowChrome track={track} isSelected={isSelected} showProviderIcon={showProviderIcon} />
        {isEditMode && onRemove && !isSelected && (
          <RemoveButton onClick={handleRemoveClick} aria-label={`Remove ${track.name}`}>
            <CloseIcon />
          </RemoveButton>
        )}
      </QueueListItem>
      {menu && <QueueRowMenu menu={menu} options={options} closeMenu={closeMenu} />}
    </div>
  );
});

export const SwipeableQueueItem = memo<QueueItemProps>(({
  track,
  index,
  isSelected,
  onSelect,
  onRemove,
  onPlayNext,
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

  const { menu, closeMenu, handleContextMenu, longPressHandlers, options } = useQueueItemContextMenu(
    track,
    index,
    isSelected,
    onRemove,
    onPlayNext,
  );

  const rowProps = {
    ref: itemRef,
    onContextMenu: handleContextMenu,
    'data-testid': 'queue-track-row',
    $isSelected: isSelected,
    ...longPressHandlers,
  } as const;

  if (!canRemove) {
    return (
      <>
        <QueueListItem
          {...rowProps}
          onClick={() => {
            if (!isEditMode) onSelect(index);
          }}
        >
          <QueueItemRowChrome track={track} isSelected={isSelected} showProviderIcon={showProviderIcon} />
        </QueueListItem>
        {menu && <QueueRowMenu menu={menu} options={options} closeMenu={closeMenu} />}
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
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '8px 16px',
                font: 'inherit',
                fontWeight: 600,
              }}
              aria-label={`Remove ${track.name}`}
            >
              Remove
            </button>
          </SwipeRemoveBackdrop>
        )}
        <SwipeableContent $offsetX={offsetX} $isSwiping={isSwiping}>
          <QueueListItem
            {...rowProps}
            onClick={() => !isRevealed && !isEditMode && onSelect(index)}
          >
            <QueueItemRowChrome
              track={track}
              isSelected={isSelected}
              showProviderIcon={showProviderIcon}
              showPlayingIndicator={!isRevealed}
            />
          </QueueListItem>
        </SwipeableContent>
      </SwipeableWrapper>
      {menu && <QueueRowMenu menu={menu} options={options} closeMenu={closeMenu} />}
    </>
  );
});
