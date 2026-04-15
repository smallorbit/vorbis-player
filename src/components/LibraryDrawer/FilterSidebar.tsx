import type { ProviderId } from '@/types/domain';
import type {
  RecentlyAddedFilterOption,
  PlaylistSortOption,
  AlbumSortOption,
} from '@/utils/playlistFilters';
import { PLAYLIST_SORT_LABELS, ALBUM_SORT_LABELS } from '@/utils/playlistFilters';
import {
  SidebarContainer,
  FilterSection,
  SectionTitle,
  SearchInputWrapper,
  SearchIcon,
  SearchInput,
  ClearSearchButton,
  ToggleGroup,
  ToggleButton,
  ChipList,
  FilterChip,
  SortSelect,
  ClearFiltersButton,
} from './FilterSidebar.styled';

interface FilterSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;

  viewMode: 'playlists' | 'albums';
  onViewModeChange: (type: 'playlists' | 'albums') => void;

  enabledProviderIds: ProviderId[];
  selectedProviderIds: ProviderId[];
  onProviderToggle: (provider: ProviderId) => void;

  showProviderFilter: boolean;

  /** Available genres derived from the current collection set. */
  availableGenres: string[];
  /** Currently selected genres (empty = all genres included). */
  selectedGenres: string[];
  onGenreToggle: (genre: string) => void;

  recentlyAdded: RecentlyAddedFilterOption;
  onRecentlyAddedChange: (value: RecentlyAddedFilterOption) => void;

  playlistSort: PlaylistSortOption;
  setPlaylistSort: (v: PlaylistSortOption) => void;
  albumSort: AlbumSortOption;
  setAlbumSort: (v: AlbumSortOption) => void;

  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

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
  viewMode,
  onViewModeChange,
  enabledProviderIds,
  selectedProviderIds,
  onProviderToggle,
  showProviderFilter,
  availableGenres,
  selectedGenres,
  onGenreToggle,
  recentlyAdded,
  onRecentlyAddedChange,
  playlistSort,
  setPlaylistSort,
  albumSort,
  setAlbumSort,
  hasActiveFilters,
  onClearFilters,
}: FilterSidebarProps) => {
  const isProviderActive = (provider: ProviderId): boolean =>
    selectedProviderIds.length === 0 || selectedProviderIds.includes(provider);

  const isGenreActive = (genre: string): boolean =>
    selectedGenres.length === 0 || selectedGenres.includes(genre);

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
            $active={viewMode === 'playlists'}
            onClick={() => onViewModeChange('playlists')}
          >
            Playlists
          </ToggleButton>
          <ToggleButton
            $active={viewMode === 'albums'}
            onClick={() => onViewModeChange('albums')}
          >
            Albums
          </ToggleButton>
        </ToggleGroup>
      </FilterSection>

      {showProviderFilter && (
        <FilterSection>
          <SectionTitle>Providers</SectionTitle>
          <ChipList>
            {enabledProviderIds.map((provider) => {
              const active = isProviderActive(provider);
              return (
                <FilterChip
                  key={provider}
                  type="button"
                  $active={active}
                  aria-pressed={active}
                  aria-label={`Filter by ${provider}`}
                  onClick={() => onProviderToggle(provider)}
                >
                  {provider}
                </FilterChip>
              );
            })}
          </ChipList>
        </FilterSection>
      )}

      {availableGenres.length > 0 && (
        <FilterSection>
          <SectionTitle>Genres</SectionTitle>
          <ChipList>
            {availableGenres.map((genre) => {
              const active = isGenreActive(genre);
              return (
                <FilterChip
                  key={genre}
                  type="button"
                  $active={active}
                  aria-pressed={active}
                  aria-label={`Filter by genre: ${genre}`}
                  onClick={() => onGenreToggle(genre)}
                >
                  {genre}
                </FilterChip>
              );
            })}
          </ChipList>
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
        {viewMode === 'playlists' ? (
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
        <ClearFiltersButton onClick={onClearFilters}>
          Clear Filters
        </ClearFiltersButton>
      )}
    </SidebarContainer>
  );
};
