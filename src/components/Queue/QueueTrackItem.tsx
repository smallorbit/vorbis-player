import React, { memo, useCallback, useRef, useState } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHorizontalSwipeToRemove } from '@/hooks/useHorizontalSwipeToRemove';
import { useLongPress } from '@/hooks/useLongPress';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { QueueContextMenu } from './QueueContextMenu';
import { QueueTrackRowBody } from './QueueTrackRowBody';
import {
  QueueListItem,
  DragHandle,
  RemoveButton,
  SwipeableWrapper,
  SwipeableContent,
  SwipeRemoveBackdrop,
} from './QueueTrackList.styled';

const DRAG_ACTIVE_Z = 10;

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

const ContextPlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ContextHeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const ContextTrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

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
      icon: <ContextPlayIcon />,
      onClick: () => onPlayNext?.(index),
    },
    ...(canSaveTrack
      ? [{ label: isLiked ? 'Unlike' : 'Like', icon: <ContextHeartIcon filled={isLiked} />, onClick: handleLikeToggle }]
      : []),
    ...(!isSelected && onRemove
      ? [{ label: 'Remove from queue', icon: <ContextTrashIcon />, onClick: () => onRemove(index), destructive: true }]
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
            <RemoveIcon />
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
