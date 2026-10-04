import { memo } from 'react';
import type { MediaTrack } from '@/types/domain';
import { formatDuration } from '@/utils/formatDuration';
import { Avatar } from '@/components/styled';
import ProviderIcon from '@/components/ProviderIcon';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { AlbumDiscIcon } from '@/components/icons/ActionIcons';
import { StrokeHeartIcon } from '@/components/icons/HeartIcons';
import { PlayIcon as PlayGlyph } from '@/components/icons/PlaybackIcons';
import {
  AlbumArtContainer,
  PlayIcon,
  TrackInfo,
  TrackName,
  TrackArtist,
  Duration,
  LikedIndicator,
} from './QueueTrackList.styled';

const PlayingIcon = () => (
  <PlayIcon>
    <PlayGlyph size={20} />
  </PlayIcon>
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
          fallback={<AlbumDiscIcon />}
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
          <StrokeHeartIcon filled size={12} />
        </LikedIndicator>
      )}
    </>
  );
});
