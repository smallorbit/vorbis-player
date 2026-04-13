import { useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import type { ProviderId } from '@/types/domain';
import type {
  RecentlyAddedFilterOption,
  PlaylistSortOption,
  AlbumSortOption,
} from '@/utils/playlistFilters';
import { PLAYLIST_SORT_LABELS, ALBUM_SORT_LABELS } from '@/utils/playlistFilters';

interface FilterSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;

  collectionType: 'playlists' | 'albums';
  onCollectionTypeChange: (type: 'playlists' | 'albums') => void;

  enabledProviderIds: ProviderId[];
  selectedProviderIds: ProviderId[];
  onProviderFilterChange: (providerIds: ProviderId[]) => void;

  showProviderFilter: boolean;

  /** Available genres derived from the current collection set. */
  availableGenres: string[];
  /** Currently selected genres (empty = all genres included). */
  selectedGenres: string[];
  onGenreChange: (genres: string[]) => void;

  recentlyAdded: RecentlyAddedFilterOption;
  onRecentlyAddedChange: (value: RecentlyAddedFilterOption) => void;

  playlistSort: PlaylistSortOption;
  setPlaylistSort: (v: PlaylistSortOption) => void;
  albumSort: AlbumSortOption;
  setAlbumSort: (v: AlbumSortOption) => void;
}

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  padding: ${theme.spacing.lg};
  background: rgba(20, 20, 20, 0.3);
  flex-shrink: 0;

  /* Desktop: persistent left sidebar */
  @media (min-width: ${theme.breakpoints.lg}) {
    border-right: 1px solid ${theme.colors.popover.border};
    min-width: 200px;
    max-height: 100%;
    overflow-y: auto;
  }
`;

const FilterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SearchInputWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  padding: 0 ${theme.spacing.sm};
  transition: all ${theme.transitions.fast};

  &:focus-within {
    border-color: ${theme.colors.control.borderHover};
    background: ${theme.colors.control.backgroundHover};
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
  padding: ${theme.spacing.sm} 0;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.white};
  min-width: 0;

  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

const ClearSearchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
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

const ToggleGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  flex-direction: column;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${({ $active }) =>
    $active ? theme.colors.control.backgroundHover : theme.colors.control.background};
  border: 1px solid
    ${({ $active }) =>
      $active ? theme.colors.control.borderHover : theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  color: ${({ $active }) =>
    $active ? theme.colors.white : theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  text-align: left;
  font-weight: ${({ $active }) => ($active ? theme.fontWeight.semibold : theme.fontWeight.normal)};

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    color: ${theme.colors.white};
  }

  &:active {
    opacity: 0.8;
  }
`;

const ProviderCheckboxContainer = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  cursor: pointer;
  border-radius: ${theme.borderRadius.md};
  transition: background ${theme.transitions.fast};

  &:hover {
    background: ${theme.colors.control.background};
  }
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${theme.colors.spotify};
`;

const CheckboxLabel = styled.span`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.muted.foreground};
  transition: color ${theme.transitions.fast};

  ${ProviderCheckboxContainer}:hover & {
    color: ${theme.colors.white};
  }
`;

const SortSelect = styled.select`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  appearance: none;

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

const ClearFiltersButton = styled.button`
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  margin-top: auto;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    color: ${theme.colors.white};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

const RECENTLY_ADDED_OPTIONS: { label: string; value: RecentlyAddedFilterOption }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7-days' },
  { label: 'Last 30 days', value: '30-days' },
  { label: 'Last year', value: '1-year' },
];

export const FilterSidebar = ({
  searchQuery,
  onSearchChange,
  collectionType,
  onCollectionTypeChange,
  enabledProviderIds,
  selectedProviderIds,
  onProviderFilterChange,
  showProviderFilter,
  availableGenres,
  selectedGenres,
  onGenreChange,
  recentlyAdded,
  onRecentlyAddedChange,
  playlistSort,
  setPlaylistSort,
  albumSort,
  setAlbumSort,
}: FilterSidebarProps) => {
  const hasActiveFilters =
    searchQuery !== '' ||
    collectionType === 'albums' ||
    selectedProviderIds.length > 0 ||
    selectedGenres.length > 0 ||
    (recentlyAdded !== 'all' && recentlyAdded !== undefined);

  const handleClearFilters = useCallback(() => {
    onSearchChange('');
    onCollectionTypeChange('playlists');
    onProviderFilterChange([]);
    onGenreChange([]);
    onRecentlyAddedChange('all');
  }, [onSearchChange, onCollectionTypeChange, onProviderFilterChange, onGenreChange, onRecentlyAddedChange]);

  const handleProviderToggle = useCallback((provider: ProviderId) => {
    if (selectedProviderIds.includes(provider)) {
      const next = selectedProviderIds.filter((p) => p !== provider);
      onProviderFilterChange(next.length === enabledProviderIds.length ? [] : next);
    } else {
      onProviderFilterChange([...selectedProviderIds, provider]);
    }
  }, [selectedProviderIds, enabledProviderIds, onProviderFilterChange]);

  const handleGenreToggle = useCallback((genre: string) => {
    if (selectedGenres.includes(genre)) {
      onGenreChange(selectedGenres.filter((g) => g !== genre));
    } else {
      onGenreChange([...selectedGenres, genre]);
    }
  }, [selectedGenres, onGenreChange]);

  return (
    <SidebarContainer>
      <FilterSection>
        <SectionTitle>Search</SectionTitle>
        <SearchInputWrapper>
          <SearchIcon>
            <SearchIconSvg />
          </SearchIcon>
          <SearchInput
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search playlists and albums"
          />
          {searchQuery && (
            <ClearSearchButton
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              type="button"
            >
              <ClearIconSvg />
            </ClearSearchButton>
          )}
        </SearchInputWrapper>
      </FilterSection>

      <FilterSection>
        <SectionTitle>Collection Type</SectionTitle>
        <ToggleGroup>
          <ToggleButton
            $active={collectionType === 'playlists'}
            onClick={() => onCollectionTypeChange('playlists')}
          >
            Playlists
          </ToggleButton>
          <ToggleButton
            $active={collectionType === 'albums'}
            onClick={() => onCollectionTypeChange('albums')}
          >
            Albums
          </ToggleButton>
        </ToggleGroup>
      </FilterSection>

      {showProviderFilter && (
        <FilterSection>
          <SectionTitle>Providers</SectionTitle>
          <div>
            {enabledProviderIds.map((provider) => (
              <ProviderCheckboxContainer key={provider}>
                <Checkbox
                  type="checkbox"
                  checked={
                    selectedProviderIds.length === 0 ||
                    selectedProviderIds.includes(provider)
                  }
                  onChange={() => handleProviderToggle(provider)}
                  aria-label={`Filter by ${provider}`}
                />
                <CheckboxLabel>{provider}</CheckboxLabel>
              </ProviderCheckboxContainer>
            ))}
          </div>
        </FilterSection>
      )}

      {availableGenres.length > 0 && (
        <FilterSection>
          <SectionTitle>Genres</SectionTitle>
          <div>
            {selectedGenres.length > 0 && (
              <ProviderCheckboxContainer>
                <Checkbox
                  type="checkbox"
                  checked={false}
                  onChange={() => onGenreChange([])}
                  aria-label="Show all genres"
                />
                <CheckboxLabel>All genres</CheckboxLabel>
              </ProviderCheckboxContainer>
            )}
            {availableGenres.map((genre) => (
              <ProviderCheckboxContainer key={genre}>
                <Checkbox
                  type="checkbox"
                  checked={selectedGenres.length === 0 || selectedGenres.includes(genre)}
                  onChange={() => handleGenreToggle(genre)}
                  aria-label={`Filter by genre: ${genre}`}
                />
                <CheckboxLabel>{genre}</CheckboxLabel>
              </ProviderCheckboxContainer>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection>
        <SectionTitle>Recently Added</SectionTitle>
        <ToggleGroup>
          {RECENTLY_ADDED_OPTIONS.map(({ label, value }) => (
            <ToggleButton
              key={value}
              $active={(recentlyAdded ?? 'all') === value}
              onClick={() => onRecentlyAddedChange(value)}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleGroup>
      </FilterSection>

      <FilterSection>
        <SectionTitle>Sort</SectionTitle>
        {collectionType === 'playlists' ? (
          <SortSelect
            value={playlistSort}
            onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
            aria-label="Sort playlists"
          >
            {Object.entries(PLAYLIST_SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SortSelect>
        ) : (
          <SortSelect
            value={albumSort}
            onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
            aria-label="Sort albums"
          >
            {Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SortSelect>
        )}
      </FilterSection>

      {hasActiveFilters && (
        <ClearFiltersButton onClick={handleClearFilters}>
          Clear Filters
        </ClearFiltersButton>
      )}
    </SidebarContainer>
  );
};
