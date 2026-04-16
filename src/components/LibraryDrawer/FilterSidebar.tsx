import type { ProviderId } from '@/types/domain';
import type {
  PlaylistSortOption,
  AlbumSortOption,
} from '@/utils/playlistFilters';
import { PLAYLIST_SORT_LABELS, ALBUM_SORT_LABELS } from '@/utils/playlistFilters';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';
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
  RecentlyPlayedList,
  RecentlyPlayedItem,
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

  recentlyPlayed: RecentlyPlayedEntry[];
  onRecentlyPlayedSelect: (entry: RecentlyPlayedEntry) => void;

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
  recentlyPlayed,
  onRecentlyPlayedSelect,
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

      {recentlyPlayed.length > 0 && (
        <FilterSection>
          <SectionTitle>Recently Played</SectionTitle>
          <RecentlyPlayedList>
            {recentlyPlayed.slice(0, 5).map((entry) => {
              const key = `${entry.ref.provider}:${entry.ref.kind}:${entry.ref.kind === 'liked' ? '' : entry.ref.id}`;
              return (
                <RecentlyPlayedItem
                  key={key}
                  type="button"
                  onClick={() => onRecentlyPlayedSelect(entry)}
                  aria-label={`Play ${entry.name}`}
                >
                  {entry.name}
                </RecentlyPlayedItem>
              );
            })}
          </RecentlyPlayedList>
        </FilterSection>
      )}

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
