import { useState, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import {
  type PlaylistInfo,
  type AlbumInfo
} from '../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import { Card, CardContent, Button, Skeleton, Alert, AlertDescription } from './styled';
import { theme } from '@/styles/theme';
import ProviderIcon from './ProviderIcon';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useLibrarySync } from '../hooks/useLibrarySync';
import {
  filterAndSortPlaylists,
  filterAndSortAlbums,
  partitionByPinned,
  type PlaylistSortOption,
  type AlbumSortOption
} from '../utils/playlistFilters';
import { usePinnedItems } from '../hooks/usePinnedItems';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../constants/playlist';
import LibraryProviderBar from './LibraryProviderBar';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { librarySyncEngine } from '@/services/cache/librarySyncEngine';
import TrackInfoPopover, {
  SpotifyIcon,
  PlayIcon,
  DiscogsIcon,
  AddToLibraryIcon,
  RemoveFromLibraryIcon,
  AddToQueueIcon,
  ICON_MAP,
} from './controls/TrackInfoPopover';

type ViewMode = 'playlists' | 'albums';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: import('@/types/domain').ProviderId) => void;
  onAddToQueue?: (playlistId: string, playlistName?: string, provider?: import('@/types/domain').ProviderId) => void;
  /** When true, uses compact layout for drawer context (no centering, fills available space) */
  inDrawer?: boolean;
  /** Ref for swipe-to-close gesture zone (search/filters area only, not the scrollable list) */
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  /** Pre-populate the search input when the drawer opens */
  initialSearchQuery?: string;
  /** Set the active tab when the drawer opens */
  initialViewMode?: 'playlists' | 'albums';
}

type AlbumPopoverState = {
  album: AlbumInfo;
  rect: DOMRect;
} | null;

type PlaylistPopoverState = {
  playlist: PlaylistInfo;
  rect: DOMRect;
} | null;

function selectOptimalImage(
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number = 64
): string | undefined {
  if (!images?.length) {
    return undefined;
  }

  const suitable = images
    .filter(img => (img.width || 0) >= targetSize)
    .sort((a, b) => (a.width || 0) - (b.width || 0));

  return suitable[0]?.url || images[images.length - 1]?.url;
}

const Container = styled.div<{ $inDrawer?: boolean }>`
  width: 100%;
  display: flex;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 0 ${theme.spacing.lg} ${theme.spacing.md};
    box-sizing: border-box;
  `
      : `
    min-height: 100vh;
    min-height: 100dvh;
    align-items: center;
    justify-content: center;
    padding: 1rem;

    @media (max-width: ${theme.breakpoints.lg}) {
      padding: 0.5rem;
    }
  `}
`;

const SelectionCard = styled(Card) <{ $maxWidth: number; $inDrawer?: boolean }>`
  width: 100%;
  max-width: ${({ $maxWidth, $inDrawer }) => ($inDrawer ? 'none' : `${$maxWidth}px`)};
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: none;
    background-color: transparent;
    backdrop-filter: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    margin: 0;
  `
      : `
    background: ${theme.colors.muted.background};
    backdrop-filter: blur(12px);
    border: 1px solid ${theme.colors.control.border};
    border-radius: 1.25rem;
    box-shadow: ${theme.shadows.albumArt};
    display: flex;
    flex-direction: column;
    max-height: min(90dvh, 900px);
  `}
`;


const DrawerContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 ${theme.spacing.md};
  overflow: hidden;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
`;

const PlaylistGrid = styled.div<{ $inDrawer?: boolean }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $inDrawer }) => ($inDrawer ? '160px' : '280px')}, 1fr));
  gap: ${({ $inDrawer }) => ($inDrawer ? '0.75rem' : '1rem')};
  padding: 1rem 0;
  overflow-y: auto;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  `
      : `
    flex: 1;
    min-height: 0;
  `}
`;

/* ── Mobile grid card layout (2-column, prominent album art) ── */

const MobileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 0.75rem;
  padding: 0.25rem 0 1rem;
  overflow-y: auto;
  flex: 1 1 0px;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  align-content: start;
`;

const GridCard = styled.div`
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: transform 0.15s ease, background 0.15s ease;
  min-width: 0;

  &:active {
    transform: scale(0.97);
    background: rgba(255, 255, 255, 0.04);
  }
`;

const GridCardArtWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  overflow: hidden;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.gray[800]}, ${({ theme }) => theme.colors.gray[700]});

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const GridCardTextArea = styled.div`
  padding: 0.5rem 0.125rem 0;
`;

const GridCardTitle = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
`;

const GridCardSubtitle = styled.div<{ $clickable?: boolean }>`
  font-size: 0.6875rem;
  color: ${({ theme }) => theme.colors.muted.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
  margin-top: 1px;
  ${({ theme, $clickable }) => $clickable && `
    cursor: pointer;
    transition: color ${theme.transitions.fast} ease;

    &:hover {
      color: ${theme.colors.accent};
      text-decoration: underline;
    }

    &:active {
      color: ${theme.colors.selection};
    }
  `}
`;

const PlaylistItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-2px);
  }
`;

const PlaylistImageWrapper = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: linear-gradient(45deg, ${({ theme }) => theme.colors.gray[700]}, ${({ theme }) => theme.colors.gray[600]});
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const PlaylistInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlaylistName = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
`;

const PlaylistDetails = styled.div`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
`;

const ClickableArtist = styled.span`
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: ${theme.colors.accent};
    text-decoration: underline;
  }

  &:active {
    color: rgba(218, 165, 32, 0.8);
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
`;

const spinnerKeyframes = `
  @keyframes vorbis-spinner-spin {
    to { transform: rotate(360deg); }
  }
`;

// Inject the keyframes once
if (typeof document !== 'undefined' && !document.getElementById('vorbis-spinner-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vorbis-spinner-keyframes';
  style.textContent = spinnerKeyframes;
  document.head.appendChild(style);
}

const TabSpinner = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: #1db954;
  border-radius: 50%;
  animation: vorbis-spinner-spin 0.8s linear infinite;
  margin-left: 0.4rem;
  vertical-align: middle;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid ${({ theme }) => theme.colors.popover.border};
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: none;
  border: none;
  color: ${({ theme, $active }) => ($active ? theme.colors.spotify : theme.colors.muted.foreground)};
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.spotify : 'transparent')};
  margin-bottom: -2px;
  position: relative;

  &:hover {
    color: ${({ theme, $active }) => ($active ? theme.colors.spotify : theme.colors.foreground)};
  }

  &:focus {
    outline: none;
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  outline: none;
  transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &::placeholder {
    color: ${({ theme }) => theme.colors.muted.foreground};
  }

  &:focus {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const SelectDropdown = styled.select`
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  outline: none;
  transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  option {
    background: ${({ theme }) => theme.colors.popover.background};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const DrawerBottomControls = styled.div`
  flex-shrink: 0;
  padding: ${theme.spacing.sm} 0 0;

  /* Remove bottom margin from ControlsContainer when at bottom of drawer */
  & > div {
    margin-bottom: 0;
  }
`;

const ClearButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const EmptyState = styled.div<{ $fullWidth?: boolean }>`
  ${({ $fullWidth }) => $fullWidth && 'grid-column: 1 / -1;'}
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.muted.foreground};
`;

const PinButton = styled.button<{ $isPinned: boolean; $disabled?: boolean }>`
  background: none;
  border: none;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  padding: ${({ theme }) => theme.spacing.xs};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ $isPinned, $disabled }) => ($isPinned ? 1 : $disabled ? 0.3 : 0)};
  color: ${({ theme, $isPinned }) => ($isPinned ? theme.colors.spotify : theme.colors.muted.foreground)};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  flex-shrink: 0;

  @media (hover: none) {
    opacity: ${({ $isPinned, $disabled }) => ($isPinned ? 1 : $disabled ? 0.3 : 0.5)};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const PinnableListItem = styled(PlaylistItem)`
  &:hover ${PinButton} {
    opacity: 1;
  }
`;

const GridCardPinOverlay = styled.div<{ $isPinned: boolean }>`
  position: absolute;
  top: ${({ theme }) => theme.spacing.sm};
  right: ${({ theme }) => theme.spacing.sm};
  z-index: 2;
  background: ${({ theme }) => theme.colors.overlay.bar};
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ $isPinned }) => ($isPinned ? 1 : 0)};
  transition: opacity ${({ theme }) => theme.transitions.fast} ease;
  cursor: pointer;
  color: ${({ theme, $isPinned }) => ($isPinned ? theme.colors.spotify : theme.colors.foreground)};

  @media (hover: none) {
    opacity: 1;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const ProviderBadgeOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing.sm};
  left: ${({ theme }) => theme.spacing.sm};
  z-index: 2;
`;

const PinnableGridCard = styled(GridCard)`
  &:hover ${GridCardPinOverlay} {
    opacity: 1;
  }
`;

const PinnedSectionLabel = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  color: ${({ theme }) => theme.colors.gray[500]};
  font-size: 0.6875rem;
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.popover.border};
  }
`;

const PinIcon: React.FC<{ filled?: boolean }> = ({ filled = false }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {filled ? (
      <path d="M16 3a1 1 0 0 0-1.4-.2L12 5l-3-1.5a1 1 0 0 0-1.2.3L6 6.5a1 1 0 0 0 .1 1.3L9 10l-1 4-3.3 3.3a1 1 0 0 0 0 1.4 1 1 0 0 0 1.4 0L9.5 15l4-1 2.2 2.9a1 1 0 0 0 1.3.1l2.7-1.8a1 1 0 0 0 .3-1.2L18.5 11l2.2-2.6a1 1 0 0 0-.2-1.4L16 3z" fill="currentColor" />
    ) : (
      <path d="M16 3a1 1 0 0 0-1.4-.2L12 5l-3-1.5a1 1 0 0 0-1.2.3L6 6.5a1 1 0 0 0 .1 1.3L9 10l-1 4-3.3 3.3a1 1 0 0 0 0 1.4 1 1 0 0 0 1.4 0L9.5 15l4-1 2.2 2.9a1 1 0 0 0 1.3.1l2.7-1.8a1 1 0 0 0 .3-1.2L18.5 11l2.2-2.6a1 1 0 0 0-.2-1.4L16 3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    )}
  </svg>
);

function getLikedSongsGradient(providerId?: string | 'unified'): string {
  if (providerId === 'unified') {
    return `linear-gradient(135deg, ${theme.colors.spotify} 0%, ${theme.colors.dropbox} 100%)`;
  }
  if (providerId === 'dropbox') {
    return `linear-gradient(135deg, ${theme.colors.dropbox} 0%, ${theme.colors.dropboxLight} 100%)`;
  }
  return `linear-gradient(135deg, ${theme.colors.spotify} 0%, ${theme.colors.spotifyLight} 100%)`;
}

/** Shared hook for lazy-loading images via IntersectionObserver */
function useLazyImage(
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number,
  rootMargin: string
) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (isVisible && images) {
      setImageUrl(selectOptimalImage(images, targetSize));
    }
  }, [isVisible, images, targetSize]);

  return { ref, imageUrl };
}

interface LazyImageProps {
  images: { url: string; width: number | null; height: number | null }[];
  alt: string;
}

const PlaylistImage: React.FC<LazyImageProps> = React.memo(function PlaylistImage({ images, alt }) {
  const { ref, imageUrl } = useLazyImage(images, 64, '50px');
  return (
    <PlaylistImageWrapper ref={ref}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <span style={{ fontSize: '1.5rem' }}>🎵</span>
      )}
    </PlaylistImageWrapper>
  );
});

const GridCardImageComponent: React.FC<LazyImageProps> = React.memo(function GridCardImageComponent({ images, alt }) {
  const { ref, imageUrl } = useLazyImage(images, 300, '100px');
  return (
    <GridCardArtWrapper ref={ref}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
        }}>
          🎵
        </div>
      )}
    </GridCardArtWrapper>
  );
});

const PlaylistSelection = React.memo(function PlaylistSelection({ onPlaylistSelect, onAddToQueue, inDrawer = false, swipeZoneRef, initialSearchQuery, initialViewMode }: PlaylistSelectionProps): JSX.Element {
  const { activeDescriptor, hasMultipleProviders, enabledProviderIds, getDescriptor } = useProviderContext();
  const { isUnifiedLikedActive, totalCount: unifiedLikedCount } = useUnifiedLikedTracks();
  const showProviderBadges = hasMultipleProviders && enabledProviderIds.length > 1;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (initialViewMode) return initialViewMode;
    const saved = localStorage.getItem('vorbis-player-view-mode');
    return (saved === 'albums' ? 'albums' : 'playlists') as ViewMode;
  });
  const {
    playlists,
    albums,
    likedSongsCount,
    likedSongsPerProvider,
    isInitialLoadComplete,
  } = useLibrarySync();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [playlistSort, setPlaylistSort] = useLocalStorage<PlaylistSortOption>(
    'vorbis-player-playlist-sort',
    'recently-added'
  );
  const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
    'vorbis-player-album-sort',
    'recently-added'
  );
  const [artistFilter, setArtistFilter] = useState<string>('');
  const [albumPopover, setAlbumPopover] = useState<AlbumPopoverState>(null);
  const [playlistPopover, setPlaylistPopover] = useState<PlaylistPopoverState>(null);
  const [albumSaved, setAlbumSaved] = useState<boolean | null>(null);
  const libraryFullyLoaded = isInitialLoadComplete;

  const { viewport, isMobile, isTablet } = usePlayerSizingContext();
  const {
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  } = usePinnedItems();

  useEffect(() => {
    if (!albumPopover) {
      setAlbumSaved(null);
      return;
    }
    const descriptor = albumPopover.album.provider
      ? getDescriptor(albumPopover.album.provider)
      : activeDescriptor;
    if (!descriptor?.capabilities.hasSaveAlbum || !descriptor.catalog.isAlbumSaved) {
      setAlbumSaved(null);
      return;
    }
    let cancelled = false;
    descriptor.catalog.isAlbumSaved(albumPopover.album.id).then((saved) => {
      if (!cancelled) setAlbumSaved(saved);
    }).catch(() => {
      if (!cancelled) setAlbumSaved(null);
    });
    return () => {
      cancelled = true;
    };
  }, [albumPopover, activeDescriptor, getDescriptor]);

  const maxWidth = useMemo(() => {
    if (isMobile) {
      return Math.min(viewport.width * 0.95, 400);
    }
    if (isTablet) {
      return Math.min(viewport.width * 0.8, 500);
    }
    return Math.min(viewport.width * 0.6, 600);
  }, [viewport.width, isMobile, isTablet]);

  // Sync when initial props change (e.g., drawer re-opened with new filter)
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-view-mode', viewMode);
  }, [viewMode]);

  const filteredPlaylists = useMemo(() => {
    return filterAndSortPlaylists(playlists, searchQuery, playlistSort);
  }, [playlists, searchQuery, playlistSort]);

  const filteredAlbums = useMemo(() => {
    return filterAndSortAlbums(albums, searchQuery, albumSort, 'all', artistFilter);
  }, [albums, searchQuery, albumSort, artistFilter]);

  const hasActiveFilters = searchQuery !== '' || artistFilter !== '';

  const { pinned: pinnedPlaylists, unpinned: unpinnedPlaylists } = useMemo(() => {
    if (hasActiveFilters || pinnedPlaylistIds.length === 0) {
      return { pinned: [] as PlaylistInfo[], unpinned: filteredPlaylists };
    }
    return partitionByPinned(filteredPlaylists, pinnedPlaylistIds, (p) => p.id);
  }, [filteredPlaylists, pinnedPlaylistIds, hasActiveFilters]);

  const { pinned: pinnedAlbums, unpinned: unpinnedAlbums } = useMemo(() => {
    if (pinnedAlbumIds.length === 0) {
      return { pinned: [] as AlbumInfo[], unpinned: filteredAlbums };
    }
    return partitionByPinned(filteredAlbums, pinnedAlbumIds, (a) => a.id);
  }, [filteredAlbums, pinnedAlbumIds]);

  useEffect(() => {
    if (viewMode === 'playlists') {
      if (artistFilter !== '') {
        setArtistFilter('');
      }
    }
  }, [viewMode, artistFilter]);

  useEffect(() => {
    if (!libraryFullyLoaded) return;
    if (playlists.length === 0 && albums.length === 0 && likedSongsCount === 0) {
      const providerName = activeDescriptor?.name ?? 'your music service';
      setError(
        `No playlists, albums, or liked songs found. Please add some music to ${providerName} first.`
      );
    } else {
      setError(null);
    }
  }, [libraryFullyLoaded, playlists.length, albums.length, likedSongsCount, activeDescriptor]);

  // Auth check — consider authenticated if ANY enabled provider has auth
  useEffect(() => {
    const hasAuth = enabledProviderIds.some(id => {
      const desc = getDescriptor(id);
      return desc?.auth.isAuthenticated();
    }) || activeDescriptor?.auth.isAuthenticated();
    if (hasAuth) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, [activeDescriptor, enabledProviderIds, getDescriptor]);

  // Sync loading state with the library sync engine
  useEffect(() => {
    if (isInitialLoadComplete || playlists.length > 0 || albums.length > 0) {
      setIsLoading(false);
    }
  }, [isInitialLoadComplete, playlists.length, albums.length]);

  function handlePlaylistClick(playlist: PlaylistInfo): void {
    console.log('🎵 Selected playlist:', playlist.name);
    onPlaylistSelect(playlist.id, playlist.name, playlist.provider);
  }

  function handleAlbumClick(album: AlbumInfo): void {
    console.log('🎵 Selected album:', album.name);
    onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider);
  }

  function handlePlaylistContextMenu(playlist: PlaylistInfo, event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    setPlaylistPopover({
      playlist,
      rect: new DOMRect(event.clientX, event.clientY, 0, 0),
    });
  }

  function handleAlbumContextMenu(album: AlbumInfo, event: React.MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    setAlbumPopover({
      album,
      rect: new DOMRect(event.clientX, event.clientY, 0, 0),
    });
  }

  function handleLikedSongsClick(provider?: import('@/types/domain').ProviderId): void {
    const resolvedProvider = provider ?? (likedSongsPerProvider.length === 1 ? likedSongsPerProvider[0].provider : undefined);
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, resolvedProvider);
  }

  function handleViewModeChange(mode: ViewMode): void {
    setViewMode(mode);
  }

  function handlePinPlaylistClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinPlaylist(id);
  }

  function handlePinAlbumClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinAlbum(id);
  }

  function handleArtistClick(artistName: string, event: React.MouseEvent): void {
    event.stopPropagation(); // Prevent album click from triggering
    setArtistFilter(artistName);
  }

  const closePlaylistPopover = React.useCallback(() => {
    setPlaylistPopover(null);
  }, []);

  const buildPlaylistPopoverOptions = React.useCallback(() => {
    if (!playlistPopover) return [];
    const playlist = playlistPopover.playlist;
    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [
      {
        label: `Play ${playlist.name}`,
        icon: <PlayIcon />,
        onClick: () => onPlaylistSelect(playlist.id, playlist.name, playlist.provider),
      },
    ];

    if (onAddToQueue) {
      options.push({
        label: 'Add to Queue',
        icon: <AddToQueueIcon />,
        onClick: () => onAddToQueue(playlist.id, playlist.name, playlist.provider),
      });
    }

    return options;
  }, [playlistPopover, onPlaylistSelect, onAddToQueue]);

  const closeAlbumPopover = React.useCallback(() => {
    setAlbumPopover(null);
  }, []);

  const buildAlbumPopoverOptions = React.useCallback(() => {
    if (!albumPopover) return [];
    const album = albumPopover.album;
    const descriptor = album.provider ? getDescriptor(album.provider) : activeDescriptor;
    const capabilities = descriptor?.capabilities;
    const catalog = descriptor?.catalog;
    const ExternalIcon = descriptor?.getExternalUrl ? DiscogsIcon : SpotifyIcon;
    const options: Array<{ label: string; icon: React.ReactNode; onClick: () => void }> = [
      {
        label: `Play ${album.name}`,
        icon: <PlayIcon />,
        onClick: () => onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider),
      },
    ];

    if (onAddToQueue) {
      options.push({
        label: 'Add to Queue',
        icon: <AddToQueueIcon />,
        onClick: () => onAddToQueue(toAlbumPlaylistId(album.id), album.name, album.provider),
      });
    }

    if (capabilities?.hasSaveAlbum && catalog?.setAlbumSaved && albumSaved !== null) {
      const saved = albumSaved;
      options.push({
        label: saved ? 'Remove from Library' : 'Add to Library',
        icon: saved ? <RemoveFromLibraryIcon /> : <AddToLibraryIcon />,
        onClick: () => {
          catalog.setAlbumSaved!(album.id, !saved).then(() => {
            if (saved) {
              librarySyncEngine.optimisticRemoveAlbum(album.id).catch(() => {});
            } else {
              librarySyncEngine.optimisticAddAlbum({
                id: album.id,
                name: album.name,
                artists: album.artists,
                images: album.images ?? [],
                release_date: album.release_date ?? '',
                total_tracks: album.total_tracks ?? 0,
                uri: album.uri ?? `spotify:album:${album.id}`,
                added_at: new Date().toISOString(),
                provider: album.provider,
              }).catch(() => {});
            }
          }).catch(() => {});
        },
      });
    }

    if (capabilities?.hasExternalLink ?? true) {
      const externalUrls = descriptor?.getExternalUrls?.({
        type: 'album',
        name: album.name,
        artistName: album.artists,
      });
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
        const providerName = capabilities?.externalLinkLabel?.replace('Open in ', '') ?? 'Spotify';
        const albumUrl = descriptor?.getExternalUrl
          ? descriptor.getExternalUrl({ type: 'album', name: album.name, artistName: album.artists })
          : (descriptor?.id === 'spotify' ? `https://open.spotify.com/album/${album.id}` : undefined);
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
  }, [albumPopover, albumSaved, getDescriptor, activeDescriptor, onPlaylistSelect, onAddToQueue]);

  const albumPopoverPortal = albumPopover ? createPortal(
    <TrackInfoPopover
      type="album"
      anchorRect={albumPopover.rect}
      onClose={closeAlbumPopover}
      options={buildAlbumPopoverOptions()}
    />,
    document.body,
  ) : null;

  const playlistPopoverPortal = playlistPopover ? createPortal(
    <TrackInfoPopover
      type="playlist"
      anchorRect={playlistPopover.rect}
      onClose={closePlaylistPopover}
      options={buildPlaylistPopoverOptions()}
    />,
    document.body,
  ) : null;

  async function handleLogin(): Promise<void> {
    try {
      await activeDescriptor?.auth.beginLogin();
    } catch (err) {
      console.error('Failed to redirect to auth:', err);
      setError('Failed to redirect to login');
    }
  }

  const hasAnyContent = playlists.length > 0 || albums.length > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !libraryFullyLoaded));

  const searchAndSortControls = (
    <ControlsContainer>
      <SearchInput
        type="text"
        placeholder={viewMode === 'playlists' ? 'Search playlists...' : 'Search albums...'}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {viewMode === 'playlists' ? (
        <SelectDropdown
          value={playlistSort}
          onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
        >
          <option value="recently-added">Recently Added</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
        </SelectDropdown>
      ) : (
        <SelectDropdown
          value={albumSort}
          onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
        >
          <option value="recently-added">Recently Added</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="artist-asc">Artist (A-Z)</option>
          <option value="artist-desc">Artist (Z-A)</option>
          <option value="release-newest">Release (Newest)</option>
          <option value="release-oldest">Release (Oldest)</option>
        </SelectDropdown>
      )}


      {(searchQuery || artistFilter) && (
        <ClearButton
          onClick={() => {
            setSearchQuery('');
            setArtistFilter('');
          }}
        >
          Clear
        </ClearButton>
      )}
    </ControlsContainer>
  );

  const tabsBar = (
    <TabsContainer>
      <TabButton
        $active={viewMode === 'playlists'}
        onClick={() => handleViewModeChange('playlists')}
      >
        Playlists{!isInitialLoadComplete && <TabSpinner />}
      </TabButton>
      <TabButton
        $active={viewMode === 'albums'}
        onClick={() => handleViewModeChange('albums')}
      >
        Albums{!isInitialLoadComplete && <TabSpinner />}
      </TabButton>
    </TabsContainer>
  );

  const mainContent = showMainContent ? (
    <>
      <LibraryProviderBar />
      <div ref={inDrawer ? swipeZoneRef : undefined} style={inDrawer ? { flexShrink: 0, touchAction: 'pan-y' } : undefined}>
        {tabsBar}
      </div>

      {viewMode === 'playlists' && (() => {
        const likedSongsPinned = isPlaylistPinned(LIKED_SONGS_ID);
        const likedSongsPinBtn = (
          <PinButton
            $isPinned={likedSongsPinned}
            $disabled={!canPinMorePlaylists && !likedSongsPinned}
            onClick={(e) => handlePinPlaylistClick(LIKED_SONGS_ID, e)}
            title={likedSongsPinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (8)')}
            aria-label={likedSongsPinned ? 'Unpin Liked Songs' : 'Pin Liked Songs to top'}
          >
            <PinIcon filled={likedSongsPinned} />
          </PinButton>
        );

        const usePerProviderLiked = showProviderBadges && likedSongsPerProvider.length >= 1 && !isUnifiedLikedActive;
        const effectiveLikedCount = isUnifiedLikedActive ? unifiedLikedCount : likedSongsCount;

        const likedSongsGridCard = effectiveLikedCount > 0 && (isUnifiedLikedActive ? (
          <PinnableGridCard key="liked-songs-unified" onClick={() => handleLikedSongsClick()}>
            <GridCardArtWrapper style={{ position: 'relative' }}>
              <div style={{ background: getLikedSongsGradient('unified'), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
              <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => handlePinPlaylistClick(LIKED_SONGS_ID, e)}>
                <PinIcon filled={likedSongsPinned} />
              </GridCardPinOverlay>
            </GridCardArtWrapper>
            <GridCardTextArea>
              <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
              <GridCardSubtitle>{effectiveLikedCount} tracks</GridCardSubtitle>
            </GridCardTextArea>
          </PinnableGridCard>
        ) : usePerProviderLiked ? (
          likedSongsPerProvider.map(({ provider, count }) => (
            <PinnableGridCard key={`liked-songs-${provider}`} onClick={() => handleLikedSongsClick(provider)}>
              <GridCardArtWrapper style={{ position: 'relative' }}>
                <div style={{ background: getLikedSongsGradient(provider), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
                <ProviderBadgeOverlay>
                  <ProviderIcon provider={provider} size={22} />
                </ProviderBadgeOverlay>
                <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => handlePinPlaylistClick(LIKED_SONGS_ID, e)}>
                  <PinIcon filled={likedSongsPinned} />
                </GridCardPinOverlay>
              </GridCardArtWrapper>
              <GridCardTextArea>
                <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
                <GridCardSubtitle>{count} tracks</GridCardSubtitle>
              </GridCardTextArea>
            </PinnableGridCard>
          ))
        ) : (
          <PinnableGridCard key="liked-songs" onClick={() => handleLikedSongsClick()}>
            <GridCardArtWrapper style={{ position: 'relative' }}>
              <div style={{ background: getLikedSongsGradient(activeDescriptor?.id), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
              <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => handlePinPlaylistClick(LIKED_SONGS_ID, e)}>
                <PinIcon filled={likedSongsPinned} />
              </GridCardPinOverlay>
            </GridCardArtWrapper>
            <GridCardTextArea>
              <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
              <GridCardSubtitle>{likedSongsCount} tracks</GridCardSubtitle>
            </GridCardTextArea>
          </PinnableGridCard>
        ));

        const likedSongsListItem = effectiveLikedCount > 0 && (isUnifiedLikedActive ? (
          <PinnableListItem key="liked-songs-unified" onClick={() => handleLikedSongsClick()}>
            <PlaylistImageWrapper>
              <div style={{ background: getLikedSongsGradient('unified'), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
            </PlaylistImageWrapper>
            <PlaylistInfo>
              <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
              <PlaylistDetails>{effectiveLikedCount} tracks • Shuffle enabled</PlaylistDetails>
            </PlaylistInfo>
            {likedSongsPinBtn}
          </PinnableListItem>
        ) : usePerProviderLiked ? (
          likedSongsPerProvider.map(({ provider, count }) => (
            <PinnableListItem key={`liked-songs-${provider}`} onClick={() => handleLikedSongsClick(provider)}>
              <div style={{ position: 'relative' }}>
                <PlaylistImageWrapper>
                  <div style={{ background: getLikedSongsGradient(provider), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
                </PlaylistImageWrapper>
                <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
                  <ProviderIcon provider={provider} size={18} />
                </div>
              </div>
              <PlaylistInfo>
                <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
                <PlaylistDetails>{count} tracks • Shuffle enabled</PlaylistDetails>
              </PlaylistInfo>
              {likedSongsPinBtn}
            </PinnableListItem>
          ))
        ) : (
          <PinnableListItem key="liked-songs" onClick={() => handleLikedSongsClick()}>
            <PlaylistImageWrapper>
              <div style={{ background: getLikedSongsGradient(activeDescriptor?.id), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
            </PlaylistImageWrapper>
            <PlaylistInfo>
              <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
              <PlaylistDetails>{likedSongsCount} tracks • Shuffle enabled</PlaylistDetails>
            </PlaylistInfo>
            {likedSongsPinBtn}
          </PinnableListItem>
        ));

        const renderPlaylistGrid = (playlist: PlaylistInfo) => {
          const pinned = isPlaylistPinned(playlist.id);
          return (
            <PinnableGridCard key={`${playlist.provider ?? 'default'}-${playlist.id}`} onClick={() => handlePlaylistClick(playlist)} onContextMenu={(e) => handlePlaylistContextMenu(playlist, e)}>
              <GridCardArtWrapper style={{ position: 'relative' }}>
                <GridCardImageComponent images={playlist.images} alt={playlist.name} />
                {showProviderBadges && playlist.provider && (
                  <ProviderBadgeOverlay>
                    <ProviderIcon provider={playlist.provider} size={22} />
                  </ProviderBadgeOverlay>
                )}
                <GridCardPinOverlay $isPinned={pinned} onClick={(e) => handlePinPlaylistClick(playlist.id, e)}>
                  <PinIcon filled={pinned} />
                </GridCardPinOverlay>
              </GridCardArtWrapper>
              <GridCardTextArea>
                <GridCardTitle>{playlist.name}</GridCardTitle>
                <GridCardSubtitle>
                  {playlist.tracks?.total ?? 0} tracks
                  {playlist.owner?.display_name && ` • ${playlist.owner.display_name}`}
                </GridCardSubtitle>
              </GridCardTextArea>
            </PinnableGridCard>
          );
        };

        const renderPlaylistList = (playlist: PlaylistInfo) => {
          const pinned = isPlaylistPinned(playlist.id);
          return (
            <PinnableListItem key={`${playlist.provider ?? 'default'}-${playlist.id}`} onClick={() => handlePlaylistClick(playlist)} onContextMenu={(e) => handlePlaylistContextMenu(playlist, e)}>
              <div style={{ position: 'relative' }}>
                <PlaylistImage images={playlist.images} alt={playlist.name} />
                {showProviderBadges && playlist.provider && (
                  <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
                    <ProviderIcon provider={playlist.provider} size={18} />
                  </div>
                )}
              </div>
              <PlaylistInfo>
                <PlaylistName>{playlist.name}</PlaylistName>
                <PlaylistDetails>
                  {playlist.tracks?.total ?? 0} tracks
                  {playlist.owner?.display_name && ` • by ${playlist.owner.display_name}`}
                </PlaylistDetails>
              </PlaylistInfo>
              <PinButton
                $isPinned={pinned}
                $disabled={!canPinMorePlaylists && !pinned}
                onClick={(e) => handlePinPlaylistClick(playlist.id, e)}
                title={pinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (8)')}
                aria-label={pinned ? `Unpin ${playlist.name}` : `Pin ${playlist.name} to top`}
              >
                <PinIcon filled={pinned} />
              </PinButton>
            </PinnableListItem>
          );
        };

        const renderFn = inDrawer ? renderPlaylistGrid : renderPlaylistList;
        const hasPinnedSection = pinnedPlaylists.length > 0 || (likedSongsPinned && likedSongsCount > 0 && !hasActiveFilters);
        const likedSongsItem = inDrawer ? likedSongsGridCard : likedSongsListItem;

        const emptyState = filteredPlaylists.length === 0 && likedSongsCount === 0 && isInitialLoadComplete && (
          <EmptyState $fullWidth={inDrawer}>
            {searchQuery
              ? `No playlists match "${searchQuery}"`
              : 'No playlists found. Create some playlists in Spotify or save some songs!'}
          </EmptyState>
        );

        const Grid = inDrawer ? MobileGrid : PlaylistGrid;
        return (
          <Grid $inDrawer={inDrawer ? undefined : false}>
            {/* Pinned section: liked songs (if pinned) + pinned playlists */}
            {!hasActiveFilters && likedSongsPinned && likedSongsItem}
            {pinnedPlaylists.map(renderFn)}
            {hasPinnedSection && <PinnedSectionLabel key="__pin-sep">Pinned</PinnedSectionLabel>}
            {/* Unpinned section: liked songs (if not pinned) + remaining playlists */}
            {(hasActiveFilters || !likedSongsPinned) && likedSongsItem}
            {unpinnedPlaylists.map(renderFn)}
            {emptyState}
          </Grid>
        );
      })()}

      {viewMode === 'albums' && (() => {
        const renderAlbumGrid = (album: AlbumInfo) => {
          const pinned = isAlbumPinned(album.id);
          return (
            <PinnableGridCard
              key={`${album.provider ?? 'default'}-${album.id}`}
              onClick={() => handleAlbumClick(album)}
              onContextMenu={(e) => handleAlbumContextMenu(album, e)}
            >
              <GridCardArtWrapper style={{ position: 'relative' }}>
                <GridCardImageComponent images={album.images} alt={`${album.name} by ${album.artists}`} />
                {showProviderBadges && album.provider && (
                  <ProviderBadgeOverlay>
                    <ProviderIcon provider={album.provider} size={22} />
                  </ProviderBadgeOverlay>
                )}
                <GridCardPinOverlay $isPinned={pinned} onClick={(e) => handlePinAlbumClick(album.id, e)}>
                  <PinIcon filled={pinned} />
                </GridCardPinOverlay>
              </GridCardArtWrapper>
              <GridCardTextArea>
                <GridCardTitle>{album.name}</GridCardTitle>
                <GridCardSubtitle
                  $clickable={true}
                  onClick={(e) => handleArtistClick(album.artists, e)}
                >
                  {album.artists}
                </GridCardSubtitle>
              </GridCardTextArea>
            </PinnableGridCard>
          );
        };

        const renderAlbumList = (album: AlbumInfo) => {
          const pinned = isAlbumPinned(album.id);
          return (
            <PinnableListItem
              key={`${album.provider ?? 'default'}-${album.id}`}
              onClick={() => handleAlbumClick(album)}
              onContextMenu={(e) => handleAlbumContextMenu(album, e)}
            >
              <div style={{ position: 'relative' }}>
                <PlaylistImage images={album.images} alt={`${album.name} by ${album.artists}`} />
                {showProviderBadges && album.provider && (
                  <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
                    <ProviderIcon provider={album.provider} size={18} />
                  </div>
                )}
              </div>
              <PlaylistInfo>
                <PlaylistName>{album.name}</PlaylistName>
                <PlaylistDetails>
                  <ClickableArtist onClick={(e) => handleArtistClick(album.artists, e)}>
                    {album.artists}
                  </ClickableArtist>
                  {' • '}{album.total_tracks} tracks
                </PlaylistDetails>
              </PlaylistInfo>
              <PinButton
                $isPinned={pinned}
                $disabled={!canPinMoreAlbums && !pinned}
                onClick={(e) => handlePinAlbumClick(album.id, e)}
                title={pinned ? 'Unpin' : (canPinMoreAlbums ? 'Pin to top' : 'Pin limit reached (8)')}
                aria-label={pinned ? `Unpin ${album.name}` : `Pin ${album.name} to top`}
              >
                <PinIcon filled={pinned} />
              </PinButton>
            </PinnableListItem>
          );
        };

        const renderFn = inDrawer ? renderAlbumGrid : renderAlbumList;

        const emptyState = filteredAlbums.length === 0 && isInitialLoadComplete && (
          <EmptyState $fullWidth={inDrawer}>
            {searchQuery || artistFilter
              ? 'No albums match your filters.'
              : 'No albums found. Save some albums in Spotify to see them here!'}
          </EmptyState>
        );

        const Grid = inDrawer ? MobileGrid : PlaylistGrid;
        return (
          <Grid $inDrawer={inDrawer ? undefined : false}>
            {pinnedAlbums.map(renderFn)}
            {pinnedAlbums.length > 0 && <PinnedSectionLabel key="__album-pin-sep">Pinned</PinnedSectionLabel>}
            {unpinnedAlbums.map(renderFn)}
            {emptyState}
          </Grid>
        );
      })()}

      {inDrawer && (
        <DrawerBottomControls>
          {searchAndSortControls}
        </DrawerBottomControls>
      )}

      {!inDrawer && (
        <div style={{ marginTop: '1.5rem' }}>
          {searchAndSortControls}
        </div>
      )}
    </>
  ) : null;

  const statusContent = (
    <>
      {isLoading && (
        <LoadingState>
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <p style={{ textAlign: 'center', color: 'white' }}>Loading your library...</p>
        </LoadingState>
      )}

      {!isLoading && !isAuthenticated && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: theme.colors.muted.foreground, marginBottom: theme.spacing.lg, fontSize: theme.fontSize.lg }}>
            Connect your {activeDescriptor?.name ?? 'music provider'} account to access your playlists
          </p>
          <Button
            onClick={handleLogin}
            style={{
              background: theme.colors.spotify,
              color: theme.colors.white,
              border: 'none',
              padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
              fontSize: theme.fontSize.base,
              borderRadius: theme.borderRadius.lg,
              cursor: 'pointer',
              transition: `background ${theme.transitions.fast} ease`
            }}
          >
            Connect {activeDescriptor?.name ?? 'account'}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription style={{ color: theme.colors.errorText }}>
            {error}
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  // When inDrawer, use a flat structure — one flex-column wrapper, no extra nesting.
  // This avoids the deep flex containment chain that breaks height propagation.
  if (inDrawer) {
    return (
      <DrawerContentWrapper>
        {statusContent}
        {mainContent}
        {albumPopoverPortal}
        {playlistPopoverPortal}
      </DrawerContentWrapper>
    );
  }

  return (
    <Container $inDrawer={false}>
      <SelectionCard $maxWidth={maxWidth} $inDrawer={false}>
        <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {statusContent}
          {mainContent}
          {albumPopoverPortal}
        {playlistPopoverPortal}
        </CardContent>
      </SelectionCard>
    </Container>
  );
});

export default PlaylistSelection;