import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { theme } from '@/styles/theme';
import {
  ChipRow,
  Chip,
  SearchChipWrapper,
  SearchChipIcon,
  SearchChipInput,
  ClearChip,
  SortChipWrapper,
  SortDropdown,
  SortOption,
  ArtistListPopover,
  ArtistOption,
  ArtistCount,
} from './styled/FilterChips';
import ProviderIcon from './ProviderIcon';
import type { ProviderId } from '@/types/domain';
import type { AlbumSortOption, PlaylistSortOption } from '@/utils/playlistFilters';
import type { AlbumInfo } from '@/services/spotify';

// ── Icons ────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <line x1="4" y1="18" x2="8" y2="18" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Sort labels ──────────────────────────────────────────────

const PLAYLIST_SORT_LABELS: Record<PlaylistSortOption, string> = {
  'recently-added': 'Recently Added',
  'name-asc': 'Name (A-Z)',
  'name-desc': 'Name (Z-A)',
};

const ALBUM_SORT_LABELS: Record<AlbumSortOption, string> = {
  'recently-added': 'Recently Added',
  'name-asc': 'Name (A-Z)',
  'name-desc': 'Name (Z-A)',
  'artist-asc': 'Artist (A-Z)',
  'artist-desc': 'Artist (Z-A)',
  'release-newest': 'Release (Newest)',
  'release-oldest': 'Release (Oldest)',
};

// ── Component ────────────────────────────────────────────────

interface FilterChipRowProps {
  viewMode: 'playlists' | 'albums';
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Sort
  playlistSort: PlaylistSortOption;
  albumSort: AlbumSortOption;
  onPlaylistSortChange: (sort: PlaylistSortOption) => void;
  onAlbumSortChange: (sort: AlbumSortOption) => void;
  // Providers
  enabledProviderIds: ProviderId[];
  activeProviderFilters: ProviderId[];
  onProviderToggle: (provider: ProviderId) => void;
  showProviderChips: boolean;
  // Artist filter (albums only)
  albums: AlbumInfo[];
  artistFilter: string;
  onArtistFilterChange: (artist: string) => void;
  // Active filters indicator
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const FilterChipRow = React.memo(function FilterChipRow({
  viewMode,
  searchQuery,
  onSearchChange,
  playlistSort,
  albumSort,
  onPlaylistSortChange,
  onAlbumSortChange,
  enabledProviderIds,
  activeProviderFilters,
  onProviderToggle,
  showProviderChips,
  albums,
  artistFilter,
  onArtistFilterChange,
  hasActiveFilters,
  onClearFilters,
}: FilterChipRowProps): JSX.Element {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [artistListOpen, setArtistListOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [artistMenuPos, setArtistMenuPos] = useState<{ top: number; left: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const artistRef = useRef<HTMLDivElement>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);

  const MENU_GAP_PX = 4;

  // ChipRow uses overflow-x: auto, which clips overflow-y — portaled menus avoid that.
  useLayoutEffect(() => {
    if (!sortOpen) {
      setSortMenuPos(null);
      return;
    }
    const update = () => {
      const el = sortRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const minW = 180;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - minW - 8));
      setSortMenuPos({ top: rect.bottom + MENU_GAP_PX, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [sortOpen]);

  useLayoutEffect(() => {
    if (!artistListOpen) {
      setArtistMenuPos(null);
      return;
    }
    const update = () => {
      const el = artistRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const minW = 200;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - minW - 8));
      setArtistMenuPos({ top: rect.top - MENU_GAP_PX, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [artistListOpen]);

  // Close dropdowns when clicking outside (menus are portaled, so check both anchors + panels)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (sortOpen) {
        const inSort =
          !!(sortRef.current?.contains(t) || sortDropdownRef.current?.contains(t));
        if (!inSort) setSortOpen(false);
      }
      if (artistListOpen) {
        const inArtist =
          !!(artistRef.current?.contains(t) || artistDropdownRef.current?.contains(t));
        if (!inArtist) setArtistListOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen, artistListOpen]);

  useEffect(() => {
    if (!sortOpen && !artistListOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSortOpen(false);
        setArtistListOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sortOpen, artistListOpen]);

  // Auto-focus search input when expanded
  useEffect(() => {
    if (searchExpanded) {
      // Small delay for animation
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [searchExpanded]);

  // Expand search if there's a non-empty query (e.g. set externally)
  useEffect(() => {
    if (searchQuery && !searchExpanded) setSearchExpanded(true);
  }, [searchQuery, searchExpanded]);

  const handleSearchToggle = useCallback(() => {
    if (searchExpanded) {
      onSearchChange('');
      setSearchExpanded(false);
    } else {
      setSearchExpanded(true);
    }
  }, [searchExpanded, onSearchChange]);

  // Top artists by album count
  const topArtists = useMemo(() => {
    if (viewMode !== 'albums') return [];
    const counts = new Map<string, number>();
    for (const a of albums) {
      if (a.artists) {
        counts.set(a.artists, (counts.get(a.artists) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [albums, viewMode]);

  const visibleArtists = topArtists.slice(0, 5);
  const hasMoreArtists = topArtists.length > 5;

  const currentSort = viewMode === 'playlists' ? playlistSort : albumSort;
  const sortLabels = viewMode === 'playlists' ? PLAYLIST_SORT_LABELS : ALBUM_SORT_LABELS;
  const currentSortLabel = sortLabels[currentSort as keyof typeof sortLabels] ?? 'Sort';

  return (
    <ChipRow>
      {/* Search chip */}
      <SearchChipWrapper $expanded={searchExpanded}>
        <SearchChipIcon onClick={handleSearchToggle} aria-label={searchExpanded ? 'Close search' : 'Search'}>
          {searchExpanded ? <CloseIcon /> : <SearchIcon />}
        </SearchChipIcon>
        {searchExpanded && (
          <SearchChipInput
            ref={searchInputRef}
            type="text"
            placeholder={viewMode === 'playlists' ? 'Search playlists...' : 'Search albums...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
      </SearchChipWrapper>

      {/* Sort chip */}
      <SortChipWrapper ref={sortRef}>
        <Chip $active={sortOpen} onClick={() => setSortOpen(!sortOpen)} aria-expanded={sortOpen} aria-haspopup="listbox">
          <SortIcon />
          {currentSortLabel}
          <ChevronDownIcon />
        </Chip>
        {sortOpen &&
          sortMenuPos &&
          createPortal(
            <SortDropdown
              ref={sortDropdownRef}
              role="listbox"
              aria-label="Sort by"
              style={{
                position: 'fixed',
                top: sortMenuPos.top,
                left: sortMenuPos.left,
                zIndex: theme.zIndex.popover,
                margin: 0,
              }}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <SortOption
                  key={value}
                  $active={currentSort === value}
                  role="option"
                  aria-selected={currentSort === value}
                  onClick={() => {
                    if (viewMode === 'playlists') {
                      onPlaylistSortChange(value as PlaylistSortOption);
                    } else {
                      onAlbumSortChange(value as AlbumSortOption);
                    }
                    setSortOpen(false);
                  }}
                >
                  {label}
                </SortOption>
              ))}
            </SortDropdown>,
            document.body
          )}
      </SortChipWrapper>

      {/* Provider chips */}
      {showProviderChips && enabledProviderIds.map((provider) => (
        <Chip
          key={provider}
          $active={activeProviderFilters.includes(provider)}
          onClick={() => onProviderToggle(provider)}
        >
          <ProviderIcon provider={provider} size={14} />
          {provider.charAt(0).toUpperCase() + provider.slice(1)}
        </Chip>
      ))}

      {/* Artist chips (albums tab only) */}
      {viewMode === 'albums' && visibleArtists.map(([artist]) => (
        <Chip
          key={artist}
          $active={artistFilter === artist}
          onClick={() => onArtistFilterChange(artistFilter === artist ? '' : artist)}
        >
          {artist}
        </Chip>
      ))}

      {/* More artists chip */}
      {viewMode === 'albums' && hasMoreArtists && (
        <SortChipWrapper ref={artistRef} style={{ position: 'relative' }}>
          <Chip $active={artistListOpen || (!!artistFilter && !visibleArtists.some(([a]) => a === artistFilter))} onClick={() => setArtistListOpen(!artistListOpen)}>
            More...
          </Chip>
          {artistListOpen &&
            artistMenuPos &&
            createPortal(
              <ArtistListPopover
                ref={artistDropdownRef}
                style={{
                  position: 'fixed',
                  top: artistMenuPos.top,
                  left: artistMenuPos.left,
                  zIndex: theme.zIndex.popover,
                  margin: 0,
                  transform: 'translateY(-100%)',
                }}
              >
                {topArtists.map(([artist, count]) => (
                  <ArtistOption
                    key={artist}
                    $active={artistFilter === artist}
                    onClick={() => {
                      onArtistFilterChange(artistFilter === artist ? '' : artist);
                      setArtistListOpen(false);
                    }}
                  >
                    {artist}
                    <ArtistCount>{count}</ArtistCount>
                  </ArtistOption>
                ))}
              </ArtistListPopover>,
              document.body
            )}
        </SortChipWrapper>
      )}

      {/* Clear filters chip */}
      {hasActiveFilters && (
        <ClearChip onClick={onClearFilters}>
          <CloseIcon />
          Clear
        </ClearChip>
      )}
    </ChipRow>
  );
});

export default FilterChipRow;
