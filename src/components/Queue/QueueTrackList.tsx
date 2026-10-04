import { memo, useRef, useEffect, useCallback, useState } from 'react';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import type { MediaTrack } from '@/types/domain';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { SortableQueueItem, SwipeableQueueItem } from './QueueTrackItem';
import { QueueListItem } from './QueueTrackList.styled';
import { EditButton } from './QueueTrackList.styled';
import { QueueListChrome } from './QueueListChrome';
import { QueueTrackRowBody } from './QueueTrackRowBody';
import { formatQueueRowAriaLabel, isQueueRowActivationKey } from './queueRowA11y';

interface QueueTrackListProps {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onRemoveTrack?: ((index: number) => void) | undefined;
  onReorderTracks?: ((fromIndex: number, toIndex: number) => void) | undefined;
  isOpen?: boolean | undefined;
  showProviderIcons?: boolean | undefined;
  canEdit?: boolean | undefined;
}

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

  useEffect(() => {
    if (isOpen && currentTrackRef.current && currentTrackIndex >= 0) {
      const timeoutId = setTimeout(() => {
        currentTrackRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, currentTrackIndex]);

  useEffect(() => {
    if (!isOpen) setIsEditMode(false);
  }, [isOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortableIds = tracks.map((t) => t.id);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    setIsDragActive(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragActive(false);
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderTracks) return;

      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderTracks(oldIndex, newIndex);
      }
    },
    [sortableIds, onReorderTracks],
  );

  const canManageQueue = !!(onRemoveTrack || onReorderTracks);

  const handlePlayNext = useCallback(
    (index: number) => {
      if (onReorderTracks && index !== currentTrackIndex) {
        const targetIndex = currentTrackIndex + 1;
        if (index < currentTrackIndex) {
          onReorderTracks(index, targetIndex - 1);
        } else {
          onReorderTracks(index, targetIndex);
        }
      }
    },
    [onReorderTracks, currentTrackIndex],
  );

  const editButton =
    canEdit && canManageQueue ? (
      <EditButton onClick={() => setIsEditMode((m) => !m)}>{isEditMode ? 'Done' : 'Edit'}</EditButton>
    ) : null;

  if (isTouch && !onReorderTracks) {
    return (
      <QueueListChrome trackCount={tracks.length} editButton={editButton}>
        {tracks.map((track, index) => (
          <SwipeableQueueItem
            key={track.id}
            track={track}
            index={index}
            isSelected={index === currentTrackIndex}
            onSelect={onTrackSelect}
            onRemove={onRemoveTrack}
            onPlayNext={handlePlayNext}
            itemRef={index === currentTrackIndex ? currentTrackRef : undefined}
            showProviderIcon={showProviderIcons}
            isEditMode={isEditMode}
          />
        ))}
      </QueueListChrome>
    );
  }

  if (canManageQueue) {
    return (
      <QueueListChrome trackCount={tracks.length} editButton={editButton}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {tracks.map((track, index) => (
              <SortableQueueItem
                key={track.id}
                track={track}
                index={index}
                isSelected={index === currentTrackIndex}
                onSelect={onTrackSelect}
                onRemove={onRemoveTrack}
                onPlayNext={handlePlayNext}
                itemRef={index === currentTrackIndex ? currentTrackRef : undefined}
                showProviderIcon={showProviderIcons}
                isDragActive={isDragActive}
                isEditMode={isEditMode}
              />
            ))}
          </SortableContext>
        </DndContext>
      </QueueListChrome>
    );
  }

  return (
    <QueueListChrome trackCount={tracks.length} metaOnly>
      {tracks.map((track, index) => (
        <QueueListItem
          key={track.id}
          ref={index === currentTrackIndex ? currentTrackRef : undefined}
          data-testid="queue-track-row"
          role="button"
          tabIndex={0}
          aria-label={formatQueueRowAriaLabel(track, index === currentTrackIndex)}
          aria-current={index === currentTrackIndex ? 'true' : undefined}
          onClick={() => onTrackSelect(index)}
          onKeyDown={(e) => {
            if (!isQueueRowActivationKey(e.key)) return;
            e.preventDefault();
            onTrackSelect(index);
          }}
          $isSelected={index === currentTrackIndex}
        >
          <QueueTrackRowBody
            track={track}
            isSelected={index === currentTrackIndex}
            showProviderIcon={showProviderIcons}
          />
        </QueueListItem>
      ))}
    </QueueListChrome>
  );
});

export default QueueTrackList;
