import React, { useState } from 'react';
import { Filter, Search as SearchIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { LibrarySearchState } from './useLibrarySearch';
import FilterSheet from './FilterSheet';
import { SearchBarRoot, InputWrap, ClearButton, FilterButton } from './SearchBar.styled';

export interface SearchBarProps {
  variant: 'mobile' | 'desktop';
  search: LibrarySearchState;
}

const SearchBar: React.FC<SearchBarProps> = ({ variant, search }) => {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <SearchBarRoot $variant={variant} data-testid={`library-search-bar-${variant}`}>
      <InputWrap>
        <SearchIcon
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            width: 16,
            height: 16,
            color: 'rgba(255,255,255,0.5)',
            pointerEvents: 'none',
          }}
        />
        <Input
          type="text"
          aria-label="Search library"
          placeholder="Search your library"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          style={{ paddingLeft: 36, paddingRight: search.query ? 32 : 12 }}
          data-testid={`library-search-input-${variant}`}
        />
        {search.query && (
          <ClearButton
            type="button"
            aria-label="Clear search"
            onClick={() => search.setQuery('')}
            data-testid={`library-search-clear-${variant}`}
          >
            <X width={14} height={14} aria-hidden="true" />
          </ClearButton>
        )}
      </InputWrap>
      <FilterButton
        type="button"
        aria-label="Filters"
        $hasActive={search.hasActiveFilters}
        onClick={() => setFilterOpen(true)}
        data-testid={`library-search-filter-${variant}`}
      >
        <Filter width={16} height={16} aria-hidden="true" />
      </FilterButton>
      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        search={search}
        side={variant === 'mobile' ? 'bottom' : 'right'}
      />
    </SearchBarRoot>
  );
};

SearchBar.displayName = 'SearchBar';
export default SearchBar;
