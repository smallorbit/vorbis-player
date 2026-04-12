import { memo, useRef, useEffect, useCallback, useState } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { formatDuration } from '@/utils/formatDuration';
import { Avatar } from '../components/styled';
import ProviderIcon from './ProviderIcon';
import { useLikeTrack } from '@/hooks/useLikeTrack';
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
} from '@dnd-kit/sortable';

import { SortableQueueItem, SwipeableQueueItem } from './QueueTrackItem';
import {
  QueueListRoot,
  QueueListCard,
  QueueListCardHeader,
  QueueListCardHeaderRow,
  EditButton,
  QueueListMeta,
  QueueListContent,
  QueueListScroll,
  QueueListItems,
  QueueListItem,
  AlbumArtContainer,
  PlayIcon,
  TrackInfo,
  TrackName,
  TrackArtist,
  Duration,
  LikedIndicator,
} from './QueueTrackList.styled';

const FilledHeartIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="12"
    height="12"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const TrackLikedIndicator = memo(({ trackId, provider }: { trackId: string; provider?: ProviderId }) => {
  const { isLiked, canSaveTrack } = useLikeTrack(trackId, provider);
  if (!canSaveTrack || !isLiked) return null;
  return (
    <LikedIndicator aria-label="Liked">
      <FilledHeartIcon />
    </LikedIndicator>
  );
});

interface QueueTrackListProps {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onRemoveTrack?: (index: number) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  isOpen?: boolean;
  showProviderIcons?: boolean;
  canEdit?: boolean;
}

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

  const handlePlayNext = useCallback((index: number) => {
    if (onReorderTracks && index !== currentTrackIndex) {
      const targetIndex = currentTrackIndex + 1;
      if (index < currentTrackIndex) {
        onReorderTracks(index, targetIndex - 1);
      } else {
        onReorderTracks(index, targetIndex);
      }
    }
  }, [onReorderTracks, currentTrackIndex]);

  const editButton = canEdit && canManageQueue ? (
    <EditButton onClick={() => setIsEditMode(m => !m)}>
      {isEditMode ? 'Done' : 'Edit'}
    </EditButton>
  ) : null;

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
                    onPlayNext={handlePlayNext}
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
                        onPlayNext={handlePlayNext}
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

  return (
    <QueueListRoot>
      <QueueListCard>
        <QueueListCardHeader>
          <QueueListMeta>{tracks.length} tracks</QueueListMeta>
        </QueueListCardHeader>
        <QueueListContent>
          <QueueListScroll>
            <QueueListItems>
              {tracks.map((track: MediaTrack, index: number) => (
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
                    {track.durationMs ? formatDuration(track.durationMs) : '--:--'}
                  </Duration>

                  <TrackLikedIndicator trackId={track.id} provider={track.provider} />
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
