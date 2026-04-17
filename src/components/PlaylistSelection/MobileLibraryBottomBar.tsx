import styled from 'styled-components';
import { theme } from '@/styles/theme';
import {
  PLAYLIST_SORT_LABELS,
  ALBUM_SORT_LABELS,
} from '@/utils/playlistFilters';
import type {
  PlaylistSortOption,
  AlbumSortOption,
} from '@/utils/playlistFilters';
import { useLibraryBrowsingContext } from './LibraryContext';

const MIN_TAP_TARGET = '44px';

const BarContainer = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} 0 ${theme.spacing.md};
`;

const SearchInputWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 0;
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  padding: 0 ${theme.spacing.sm};
  min-height: ${MIN_TAP_TARGET};
  transition: all ${theme.transitions.fast};

  &:focus-within {
    border-color: ${theme.colors.control.borderHover};
    background: ${theme.colors.control.backgroundHover};
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.9),
      0 0 0 4px rgba(255, 255, 255, 0.85),
      0 0 12px 0 rgba(255, 255, 255, 0.35);
  }
`;

const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: ${theme.colors.muted.foreground};
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: ${theme.spacing.sm} ${theme.spacing.xs};
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.white};
  min-width: 0;

  &:focus-visible {
    box-shadow: none;
  }

  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

const ClearSearchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${MIN_TAP_TARGET};
  height: ${MIN_TAP_TARGET};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${theme.colors.muted.foreground};
  transition: color ${theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    color: ${theme.colors.white};
  }

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

const SortSelect = styled.select`
  flex-shrink: 0;
  min-height: ${MIN_TAP_TARGET};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  appearance: none;
  max-width: 9rem;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    border-color: ${theme.colors.control.borderHover};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.control.borderHover};
  }

  option {
    background: ${theme.colors.popover.background};
    color: ${theme.colors.white};
  }
`;

const SearchIconSvg = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ClearIconSvg = () => (
  <svg viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function MobileLibraryBottomBar(): JSX.Element {
  const {
    viewMode,
    searchQuery,
    setSearchQuery,
    playlistSort,
    setPlaylistSort,
    albumSort,
    setAlbumSort,
  } = useLibraryBrowsingContext();

  return (
    <BarContainer>
      <SearchInputWrapper>
        <SearchIcon>
          <SearchIconSvg />
        </SearchIcon>
        <SearchInput
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search playlists and albums"
        />
        {searchQuery && (
          <ClearSearchButton
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            type="button"
          >
            <ClearIconSvg />
          </ClearSearchButton>
        )}
      </SearchInputWrapper>

      {viewMode === 'playlists' ? (
        <SortSelect
          value={playlistSort}
          onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
          aria-label="Sort playlists"
        >
          {Object.entries(PLAYLIST_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SortSelect>
      ) : (
        <SortSelect
          value={albumSort}
          onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
          aria-label="Sort albums"
        >
          {Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SortSelect>
      )}
    </BarContainer>
  );
}
