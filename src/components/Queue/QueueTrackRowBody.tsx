import { memo } from 'react';
import type { MediaTrack } from '@/types/domain';
import { formatDuration } from '@/utils/formatDuration';
import { Avatar } from '@/components/styled';
import ProviderIcon from '@/components/ProviderIcon';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import {
  AlbumArtContainer,
  PlayIcon,
  TrackInfo,
  TrackName,
  TrackArtist,
  Duration,
  LikedIndicator,
} from './QueueTrackList.styled';

const AlbumFallbackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
      fill="currentColor"
    />
  </svg>
);

const PlayingIcon = () => (
  <PlayIcon>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  </PlayIcon>
);

const QueueHeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
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

export interface QueueTrackRowBodyProps {
  track: MediaTrack;
  isSelected: boolean;
  showProviderIcon?: boolean | undefined;
  showPlayingIndicator?: boolean | undefined;
}

/** Art + title + duration row shared by read-only, sortable, and swipeable queue items (F12). */
export const QueueTrackRowBody = memo(function QueueTrackRowBody({
  track,
  isSelected,
  showProviderIcon,
  showPlayingIndicator = true,
}: QueueTrackRowBodyProps) {
  const { isLiked, canSaveTrack } = useLikeTrack(track.id, track.provider);

  return (
    <>
      <AlbumArtContainer>
        <Avatar
          src={track.image}
          alt={track.album}
          style={{ width: '3rem', height: '3rem' }}
          fallback={<AlbumFallbackIcon />}
        />
        {showPlayingIndicator && isSelected && <PlayingIcon />}
        {showProviderIcon && track.provider && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, zIndex: 2 }}>
            <ProviderIcon provider={track.provider} size={16} />
          </div>
        )}
      </AlbumArtContainer>

      <TrackInfo>
        <TrackName $isSelected={isSelected}>{track.name}</TrackName>
        <TrackArtist $isSelected={isSelected}>{track.artists}</TrackArtist>
      </TrackInfo>

      <Duration $isSelected={isSelected}>
        {track.durationMs ? formatDuration(track.durationMs) : '--:--'}
      </Duration>

      {canSaveTrack && isLiked && (
        <LikedIndicator aria-label="Liked">
          <QueueHeartIcon filled />
        </LikedIndicator>
      )}
    </>
  );
});
