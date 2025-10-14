import { memo } from 'react';
import { PlayerTrackName, PlayerTrackArtist, TrackInfoOnlyRow } from './styled';

interface TrackInfoProps {
    track: {
        name?: string;
        artists?: string;
    } | null;
    isMobile: boolean;
    isTablet: boolean;
}

// Custom comparison function for memo optimization
const areTrackInfoPropsEqual = (
    prevProps: TrackInfoProps,
    nextProps: TrackInfoProps
): boolean => {
    return (
        prevProps.track?.name === nextProps.track?.name &&
        prevProps.track?.artists === nextProps.track?.artists &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet
    );
};

export const TrackInfo = memo<TrackInfoProps>(({ track, isMobile, isTablet }) => {
    return (
        <TrackInfoOnlyRow>
            <PlayerTrackName $isMobile={isMobile} $isTablet={isTablet}>
                {track?.name || 'No track selected'}
            </PlayerTrackName>
            <PlayerTrackArtist>{track?.artists || ''}</PlayerTrackArtist>
        </TrackInfoOnlyRow>
    );
}, areTrackInfoPropsEqual);

TrackInfo.displayName = 'TrackInfo';

export default TrackInfo;
