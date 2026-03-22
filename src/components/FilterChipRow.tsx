import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as React from 'react';
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const artistRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (artistListOpen && artistRef.current && !artistRef.current.contains(e.target as Node)) {
        setArtistListOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
        <Chip $active={sortOpen} onClick={() => setSortOpen(!sortOpen)}>
          <SortIcon />
          {currentSortLabel}
          <ChevronDownIcon />
        </Chip>
        {sortOpen && (
          <SortDropdown>
            {Object.entries(sortLabels).map(([value, label]) => (
              <SortOption
                key={value}
                $active={currentSort === value}
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
          </SortDropdown>
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
          {artistListOpen && (
            <ArtistListPopover>
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
            </ArtistListPopover>
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
