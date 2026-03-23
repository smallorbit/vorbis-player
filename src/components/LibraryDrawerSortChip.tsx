import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { theme } from '@/styles/theme';
import { Chip, SortChipWrapper, SortDropdown, SortOption } from './styled/FilterChips';
import type { AlbumSortOption, PlaylistSortOption } from '@/utils/playlistFilters';

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

export interface LibraryDrawerSortChipProps {
  viewMode: 'playlists' | 'albums';
  playlistSort: PlaylistSortOption;
  albumSort: AlbumSortOption;
  onPlaylistSortChange: (sort: PlaylistSortOption) => void;
  onAlbumSortChange: (sort: AlbumSortOption) => void;
}

const LibraryDrawerSortChip = React.memo(function LibraryDrawerSortChip({
  viewMode,
  playlistSort,
  albumSort,
  onPlaylistSortChange,
  onAlbumSortChange,
}: LibraryDrawerSortChipProps): JSX.Element {
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const MENU_GAP_PX = 4;

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

  useEffect(() => {
    if (!sortOpen) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      const inSort =
        !!(sortRef.current?.contains(t) || sortDropdownRef.current?.contains(t));
      if (!inSort) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSortOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sortOpen]);

  const currentSort = viewMode === 'playlists' ? playlistSort : albumSort;
  const sortLabels = viewMode === 'playlists' ? PLAYLIST_SORT_LABELS : ALBUM_SORT_LABELS;
  const currentSortLabel = sortLabels[currentSort as keyof typeof sortLabels] ?? 'Sort';

  return (
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
  );
});

export default LibraryDrawerSortChip;
