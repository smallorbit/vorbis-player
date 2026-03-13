import { memo, Fragment, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { ArtistInfo } from '../../services/spotify';
import type { ProviderId } from '../../types/domain';
import { useProviderContext } from '../../contexts/ProviderContext';
import { PlayerTrackName, PlayerTrackAlbum, AlbumLink, PlayerTrackArtist, TrackInfoOnlyRow, ArtistLink } from './styled';
import TrackInfoPopover, { LibraryIcon, SpotifyIcon, PlayIcon, DiscogsIcon, ICON_MAP } from './TrackInfoPopover';
import { SpotifyIcon as SpotifyProviderIcon, DropboxIcon as DropboxProviderIcon } from '../icons/ProviderIcons';

const ProviderBadge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 0.375rem;
  vertical-align: middle;
  opacity: 0.85;
  flex-shrink: 0;
`;

interface TrackInfoProps {
    track: {
        name?: string;
        provider?: string;
        artists?: string;
        artistsData?: ArtistInfo[];
        album?: string;
        album_id?: string;
    } | null;
    isMobile: boolean;
    isTablet: boolean;
    onArtistBrowse?: (artistName: string) => void;
    onAlbumPlay?: (albumId: string, albumName: string) => void;
    radioActive?: boolean;
    currentProvider?: ProviderId;
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
        prevProps.onAlbumPlay === nextProps.onAlbumPlay &&
        prevProps.radioActive === nextProps.radioActive &&
        prevProps.currentProvider === nextProps.currentProvider
    );
};

type PopoverState =
    | { type: 'artist'; artistName: string; artistUrl: string; rect: DOMRect }
    | { type: 'album'; albumId: string; albumName: string; rect: DOMRect }
    | null;

const TrackInfo = memo<TrackInfoProps>(({ track, isMobile, isTablet, onArtistBrowse, onAlbumPlay, radioActive, currentProvider }) => {
    const [popover, setPopover] = useState<PopoverState>(null);
    const artistRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const albumRef = useRef<HTMLButtonElement>(null);
    const { activeDescriptor } = useProviderContext();
    const capabilities = activeDescriptor?.capabilities;

    const closePopover = useCallback(() => setPopover(null), []);

    const handleArtistClick = useCallback((e: React.MouseEvent, artist: ArtistInfo) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        setPopover({ type: 'artist', artistName: artist.name, artistUrl: artist.url, rect });
    }, []);

    const handleAlbumClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!track?.album_id || !track?.album) return;
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        setPopover({ type: 'album', albumId: track.album_id, albumName: track.album, rect });
    }, [track?.album_id, track?.album]);

    const hasExternalLink = capabilities?.hasExternalLink ?? true;
    const providerName = capabilities?.externalLinkLabel?.replace('Open in ', '') ?? 'Spotify';
    const ExternalIcon = activeDescriptor?.getExternalUrl
        ? DiscogsIcon
        : SpotifyIcon;

    const getAlbumExternalUrl = (albumId: string, albumName: string): string | undefined => {
        if (activeDescriptor?.getExternalUrl) {
            return activeDescriptor.getExternalUrl({ type: 'album', name: albumName, artistName: track?.artists });
        }
        if (track?.provider === 'spotify') {
            return `https://open.spotify.com/album/${albumId}`;
        }
        return undefined;
    };

    const renderArtists = () => {
        if (track?.artistsData && track.artistsData.length > 0) {
            return track.artistsData.map((artist, index) => (
                <Fragment key={artist.url || artist.name}>
                    <ArtistLink
                        as="button"
                        ref={(el: HTMLButtonElement | null) => {
                            const key = artist.url || artist.name;
                            if (el) artistRefs.current.set(key, el);
                            else artistRefs.current.delete(key);
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

    const buildArtistOptions = () => {
        if (!popover || popover.type !== 'artist') return [];
        const options = [
            {
                label: `Browse albums by ${popover.artistName}`,
                icon: <LibraryIcon />,
                onClick: () => onArtistBrowse?.(popover.artistName),
            },
        ];
        if (hasExternalLink) {
            const externalUrls = activeDescriptor?.getExternalUrls?.({ type: 'artist', name: popover.artistName });
            if (externalUrls) {
                for (const entry of externalUrls) {
                    const IconComponent = ICON_MAP[entry.icon] ?? DiscogsIcon;
                    options.push({
                        label: `Search ${entry.label}`,
                        icon: <IconComponent />,
                        onClick: () => void window.open(entry.url, '_blank', 'noopener,noreferrer'),
                    });
                }
            } else {
                const url = activeDescriptor?.getExternalUrl
                    ? activeDescriptor.getExternalUrl({ type: 'artist', name: popover.artistName })
                    : popover.artistUrl;
                if (url) {
                    options.push({
                        label: `View artist on ${providerName}`,
                        icon: <ExternalIcon />,
                        onClick: () => void window.open(url, '_blank', 'noopener,noreferrer'),
                    });
                }
            }
        }
        return options;
    };

    const buildAlbumOptions = () => {
        if (!popover || popover.type !== 'album') return [];
        const options = [
            {
                label: `Play ${popover.albumName}`,
                icon: <PlayIcon />,
                onClick: () => onAlbumPlay?.(popover.albumId, popover.albumName),
            },
        ];
        if (hasExternalLink) {
            const externalUrls = activeDescriptor?.getExternalUrls?.({ type: 'album', name: popover.albumName, artistName: track?.artists });
            if (externalUrls) {
                for (const entry of externalUrls) {
                    const IconComponent = ICON_MAP[entry.icon] ?? DiscogsIcon;
                    options.push({
                        label: `Search ${entry.label}`,
                        icon: <IconComponent />,
                        onClick: () => void window.open(entry.url, '_blank', 'noopener,noreferrer'),
                    });
                }
            } else {
                const albumUrl = getAlbumExternalUrl(popover.albumId, popover.albumName);
                if (albumUrl) {
                    options.push({
                        label: `View album on ${providerName}`,
                        icon: <ExternalIcon />,
                        onClick: () => void window.open(albumUrl, '_blank', 'noopener,noreferrer'),
                    });
                }
            }
        }
        return options;
    };

    const popoverContent = popover && createPortal(
        <TrackInfoPopover
            type={popover.type}
            anchorRect={popover.rect}
            onClose={closePopover}
            options={popover.type === 'artist' ? buildArtistOptions() : buildAlbumOptions()}
        />,
        document.body
    );

    const renderProviderBadge = () => {
        if (!radioActive || !currentProvider) return null;
        return (
            <ProviderBadge>
                {currentProvider === 'spotify'
                    ? <SpotifyProviderIcon size={14} />
                    : <DropboxProviderIcon size={14} />
                }
            </ProviderBadge>
        );
    };

    return (
        <>
            <TrackInfoOnlyRow $compact={isMobile || isTablet}>
                <PlayerTrackName $isMobile={isMobile} $isTablet={isTablet}>
                    {track?.name || 'No track selected'}
                    {renderProviderBadge()}
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
