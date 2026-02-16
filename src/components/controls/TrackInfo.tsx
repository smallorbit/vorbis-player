import { memo, Fragment } from 'react';
import type { ArtistInfo } from '../../services/spotify';
import { PlayerTrackName, PlayerTrackArtist, TrackInfoOnlyRow, ArtistLink } from './styled';

interface TrackInfoProps {
    track: {
        name?: string;
        artists?: string;
        artistsData?: ArtistInfo[];
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
    const renderArtists = () => {
        if (track?.artistsData && track.artistsData.length > 0) {
            return track.artistsData.map((artist, index) => (
                <Fragment key={artist.spotifyUrl}>
                    <ArtistLink
                        href={artist.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {artist.name}
                    </ArtistLink>
                    {index < track.artistsData!.length - 1 && ', '}
                </Fragment>
            ));
        }
        return track?.artists || '';
    };

    return (
        <TrackInfoOnlyRow>
            <PlayerTrackName $isMobile={isMobile} $isTablet={isTablet}>
                {track?.name || 'No track selected'}
            </PlayerTrackName>
            <PlayerTrackArtist>{renderArtists()}</PlayerTrackArtist>
        </TrackInfoOnlyRow>
    );
}, areTrackInfoPropsEqual);

TrackInfo.displayName = 'TrackInfo';

export default TrackInfo;
