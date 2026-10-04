import React, { memo, useCallback, useRef, useState } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHorizontalSwipeToRemove } from '@/hooks/useHorizontalSwipeToRemove';
import { useLongPress } from '@/hooks/useLongPress';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { QueueContextMenu } from './QueueContextMenu';
import { QueueTrackRowBody } from './QueueTrackRowBody';
import { CloseIcon, GripIcon, MoreVerticalIcon, TrashIcon } from '@/components/icons/ActionIcons';
import { formatQueueRowAriaLabel, isQueueRowActivationKey } from './queueRowA11y';
import { StrokeHeartIcon } from '@/components/icons/HeartIcons';
import { PlayIcon } from '@/components/icons/PlaybackIcons';
import {
  QueueListItem,
  DragHandle,
  RemoveButton,
  QueueRowMenuButton,
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { isLiked, handleLikeToggle, canSaveTrack } = useLikeTrack(track.id, track.provider);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenuFromTrigger = useCallback(() => {
    const el = menuTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.bottom });
  }, []);

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

  return {
    menu,
    closeMenu,
    handleContextMenu,
    longPressHandlers,
    options,
    menuTriggerRef,
    openMenuFromTrigger,
  };
}

function QueueRowMenu(props: {
  menu: ContextMenuState;
  options: ReturnType<typeof useQueueItemContextMenu>['options'];
  closeMenu: () => void;
  menuTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  const { menu, options, closeMenu, menuTriggerRef } = props;
  return (
    <QueueContextMenu
      x={menu.x}
      y={menu.y}
      options={options}
      onClose={closeMenu}
      returnFocusRef={menuTriggerRef}
    />
  );
}

function QueueRowMoreButton({
  track,
  menuTriggerRef,
  onOpenMenu,
}: {
  track: MediaTrack;
  menuTriggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  onOpenMenu: () => void;
}) {
  return (
    <QueueRowMenuButton
      ref={menuTriggerRef}
      type="button"
      aria-label={`Actions for ${track.name}`}
      aria-haspopup="menu"
      onClick={(e) => {
        e.stopPropagation();
        onOpenMenu();
      }}
    >
      <MoreVerticalIcon />
    </QueueRowMenuButton>
  );
}

function useNavigableQueueRowProps(
  track: MediaTrack,
  index: number,
  isSelected: boolean,
  onSelect: (index: number) => void,
  isEditMode: boolean,
  isDragActive: boolean,
  sortableEditActive: boolean,
) {
  const rowLabel = formatQueueRowAriaLabel(track, isSelected);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (sortableEditActive || isDragActive) return;
      if (!isQueueRowActivationKey(e.key)) return;
      e.preventDefault();
      if (!isEditMode) {
        onSelect(index);
      }
    },
    [sortableEditActive, isDragActive, isEditMode, onSelect, index],
  );

  if (sortableEditActive) {
    return { rowLabel, navigableProps: {} };
  }

  return {
    rowLabel,
    navigableProps: {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': rowLabel,
      'aria-current': isSelected ? ('true' as const) : undefined,
      onKeyDown: handleRowKeyDown,
    },
  };
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

  const {
    menu,
    closeMenu,
    handleContextMenu,
    longPressHandlers,
    options,
    menuTriggerRef,
    openMenuFromTrigger,
  } = useQueueItemContextMenu(track, index, isSelected, onRemove, onPlayNext);

  const sortableEditActive = !!(isEditMode && onRemove);
  const { navigableProps } = useNavigableQueueRowProps(
    track,
    index,
    isSelected,
    onSelect,
    !!isEditMode,
    !!isDragActive,
    sortableEditActive,
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
        {...navigableProps}
        {...(sortableEditActive ? { ...attributes, ...listeners } : {})}
        style={
          sortableEditActive
            ? { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }
            : undefined
        }
      >
        {sortableEditActive && (
          <DragHandle>
            <GripIcon />
          </DragHandle>
        )}
        <QueueItemRowChrome track={track} isSelected={isSelected} showProviderIcon={showProviderIcon} />
        <QueueRowMoreButton
          track={track}
          menuTriggerRef={menuTriggerRef}
          onOpenMenu={openMenuFromTrigger}
        />
        {sortableEditActive && !isSelected && (
          <RemoveButton onClick={handleRemoveClick} aria-label={`Remove ${track.name}`}>
            <CloseIcon />
          </RemoveButton>
        )}
      </QueueListItem>
      {menu && (
        <QueueRowMenu
          menu={menu}
          options={options}
          closeMenu={closeMenu}
          menuTriggerRef={menuTriggerRef}
        />
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

  const {
    menu,
    closeMenu,
    handleContextMenu,
    longPressHandlers,
    options,
    menuTriggerRef,
    openMenuFromTrigger,
  } = useQueueItemContextMenu(track, index, isSelected, onRemove, onPlayNext);

  const { navigableProps } = useNavigableQueueRowProps(
    track,
    index,
    isSelected,
    onSelect,
    !!isEditMode,
    false,
    false,
  );

  const rowProps = {
    ref: itemRef,
    onContextMenu: handleContextMenu,
    'data-testid': 'queue-track-row',
    $isSelected: isSelected,
    ...longPressHandlers,
    ...navigableProps,
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
          <QueueRowMoreButton
            track={track}
            menuTriggerRef={menuTriggerRef}
            onOpenMenu={openMenuFromTrigger}
          />
        </QueueListItem>
        {menu && (
          <QueueRowMenu
            menu={menu}
            options={options}
            closeMenu={closeMenu}
            menuTriggerRef={menuTriggerRef}
          />
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
            <QueueRowMoreButton
              track={track}
              menuTriggerRef={menuTriggerRef}
              onOpenMenu={openMenuFromTrigger}
            />
          </QueueListItem>
        </SwipeableContent>
      </SwipeableWrapper>
      {menu && (
        <QueueRowMenu
          menu={menu}
          options={options}
          closeMenu={closeMenu}
          menuTriggerRef={menuTriggerRef}
        />
      )}
    </>
  );
});
