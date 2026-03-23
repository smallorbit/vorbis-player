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
  SortChipWrapper,
  ArtistListPopover,
  ArtistOption,
  ArtistCount,
} from './styled/FilterChips';
import ProviderIcon from './ProviderIcon';
import type { ProviderId } from '@/types/domain';
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

// ── Component ────────────────────────────────────────────────

interface FilterChipRowProps {
  viewMode: 'playlists' | 'albums';
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Providers
  enabledProviderIds: ProviderId[];
  activeProviderFilters: ProviderId[];
  onProviderToggle: (provider: ProviderId) => void;
  showProviderChips: boolean;
  // Artist filter (albums only)
  albums: AlbumInfo[];
  artistFilter: string;
  onArtistFilterChange: (artist: string) => void;
}

const FilterChipRow = React.memo(function FilterChipRow({
  viewMode,
  searchQuery,
  onSearchChange,
  enabledProviderIds,
  activeProviderFilters,
  onProviderToggle,
  showProviderChips,
  albums,
  artistFilter,
  onArtistFilterChange,
}: FilterChipRowProps): JSX.Element {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [artistListOpen, setArtistListOpen] = useState(false);
  const [artistMenuPos, setArtistMenuPos] = useState<{ top: number; left: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLDivElement>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);

  const MENU_GAP_PX = 4;

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (artistListOpen) {
        const inArtist =
          !!(artistRef.current?.contains(t) || artistDropdownRef.current?.contains(t));
        if (!inArtist) setArtistListOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [artistListOpen]);

  useEffect(() => {
    if (!artistListOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setArtistListOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [artistListOpen]);

  useEffect(() => {
    if (searchExpanded) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [searchExpanded]);

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

  return (
    <ChipRow>
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

      {viewMode === 'albums' && visibleArtists.map(([artist]) => (
        <Chip
          key={artist}
          $active={artistFilter === artist}
          onClick={() => onArtistFilterChange(artistFilter === artist ? '' : artist)}
        >
          {artist}
        </Chip>
      ))}

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
    </ChipRow>
  );
});

export default FilterChipRow;
