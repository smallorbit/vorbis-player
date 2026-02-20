import { memo, Fragment, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ArtistInfo } from '../../services/spotify';
import { PlayerTrackName, PlayerTrackAlbum, AlbumLink, PlayerTrackArtist, TrackInfoOnlyRow, ArtistLink } from './styled';
import TrackInfoPopover, { LibraryIcon, SpotifyIcon, PlayIcon } from './TrackInfoPopover';

interface TrackInfoProps {
    track: {
        name?: string;
        artists?: string;
        artistsData?: ArtistInfo[];
        album?: string;
        album_id?: string;
    } | null;
    isMobile: boolean;
    isTablet: boolean;
    onArtistBrowse?: (artistName: string) => void;
    onAlbumPlay?: (albumId: string, albumName: string) => void;
}

// Custom comparison function for memo optimization
const areTrackInfoPropsEqual = (
    prevProps: TrackInfoProps,
    nextProps: TrackInfoProps
): boolean => {
    return (
        prevProps.track?.name === nextProps.track?.name &&
        prevProps.track?.artists === nextProps.track?.artists &&
        prevProps.track?.album === nextProps.track?.album &&
        prevProps.track?.album_id === nextProps.track?.album_id &&
        prevProps.isMobile === nextProps.isMobile &&
        prevProps.isTablet === nextProps.isTablet &&
        prevProps.onArtistBrowse === nextProps.onArtistBrowse &&
        prevProps.onAlbumPlay === nextProps.onAlbumPlay
    );
};

type PopoverState =
    | { type: 'artist'; artistName: string; artistUrl: string; rect: DOMRect }
    | { type: 'album'; albumId: string; albumName: string; rect: DOMRect }
    | null;

const TrackInfo = memo<TrackInfoProps>(({ track, isMobile, isTablet, onArtistBrowse, onAlbumPlay }) => {
    const [popover, setPopover] = useState<PopoverState>(null);
    const artistRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const albumRef = useRef<HTMLButtonElement>(null);

    const closePopover = useCallback(() => setPopover(null), []);

    const handleArtistClick = useCallback((e: React.MouseEvent, artist: ArtistInfo) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        setPopover({ type: 'artist', artistName: artist.name, artistUrl: artist.spotifyUrl, rect });
    }, []);

    const handleAlbumClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!track?.album_id || !track?.album) return;
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        setPopover({ type: 'album', albumId: track.album_id, albumName: track.album, rect });
    }, [track?.album_id, track?.album]);

    const renderArtists = () => {
        if (track?.artistsData && track.artistsData.length > 0) {
            return track.artistsData.map((artist, index) => (
                <Fragment key={artist.spotifyUrl}>
                    <ArtistLink
                        as="button"
                        ref={(el: HTMLButtonElement | null) => {
                            if (el) artistRefs.current.set(artist.spotifyUrl, el);
                            else artistRefs.current.delete(artist.spotifyUrl);
                        }}
                        onClick={(e: React.MouseEvent) => handleArtistClick(e, artist)}
                    >
                        {artist.name}
                    </ArtistLink>
                    {index < track.artistsData!.length - 1 && ', '}
                </Fragment>
            ));
        }
        return track?.artists || '';
    };

    const renderAlbum = () => {
        if (!track?.album) return null;
        if (track.album_id) {
            return (
                <AlbumLink
                    as="button"
                    ref={albumRef}
                    onClick={handleAlbumClick}
                >
                    {track.album}
                </AlbumLink>
            );
        }
        return track.album;
    };

    const popoverContent = popover && createPortal(
        <TrackInfoPopover
            type={popover.type}
            anchorRect={popover.rect}
            onClose={closePopover}
            options={popover.type === 'artist' ? [
                {
                    label: `Browse albums by ${popover.artistName}`,
                    icon: <LibraryIcon />,
                    onClick: () => onArtistBrowse?.(popover.artistName),
                },
                {
                    label: 'View artist on Spotify',
                    icon: <SpotifyIcon />,
                    onClick: () => window.open(popover.artistUrl, '_blank', 'noopener,noreferrer'),
                },
            ] : [
                {
                    label: `Play ${popover.albumName}`,
                    icon: <PlayIcon />,
                    onClick: () => onAlbumPlay?.(popover.albumId, popover.albumName),
                },
                {
                    label: 'View album on Spotify',
                    icon: <SpotifyIcon />,
                    onClick: () => window.open(`https://open.spotify.com/album/${popover.albumId}`, '_blank', 'noopener,noreferrer'),
                },
            ]}
        />,
        document.body
    );

    return (
        <>
            <TrackInfoOnlyRow $compact={isMobile || isTablet}>
                <PlayerTrackName $isMobile={isMobile} $isTablet={isTablet}>
                    {track?.name || 'No track selected'}
                </PlayerTrackName>
                {track?.album && (
                    <PlayerTrackAlbum>{renderAlbum()}</PlayerTrackAlbum>
                )}
                <PlayerTrackArtist>{renderArtists()}</PlayerTrackArtist>
            </TrackInfoOnlyRow>
            {popoverContent}
        </>
    );
}, areTrackInfoPropsEqual);

TrackInfo.displayName = 'TrackInfo';

export default TrackInfo;
