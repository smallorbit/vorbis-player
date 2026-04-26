import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { ProviderId } from '@/types/domain';
import type { LibraryKindFilter, LibrarySearchState, LibrarySort } from './useLibrarySearch';
import {
  FilterBody,
  Group,
  GroupLabel,
  CheckboxRow,
  SortSelect,
  ClearAllButton,
} from './FilterSheet.styled';

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: LibrarySearchState;
  side?: 'right' | 'bottom';
}

const KIND_OPTIONS: LibraryKindFilter[] = ['playlist', 'album'];
const SORT_OPTIONS: Array<{ value: LibrarySort; label: string }> = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'name-asc', label: 'A → Z' },
  { value: 'name-desc', label: 'Z → A' },
];

const FilterSheet: React.FC<FilterSheetProps> = ({ open, onOpenChange, search, side = 'right' }) => {
  const { enabledProviderIds } = useProviderContext();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} data-testid="library-filter-sheet">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <FilterBody>
          {enabledProviderIds.length > 1 && (
            <Group>
              <GroupLabel>Source</GroupLabel>
              {enabledProviderIds.map((id: ProviderId) => (
                <CheckboxRow key={id}>
                  <input
                    type="checkbox"
                    checked={search.providerFilter.includes(id)}
                    onChange={() => search.toggleProvider(id)}
                    data-testid={`library-filter-provider-${id}`}
                  />
                  {id}
                </CheckboxRow>
              ))}
            </Group>
          )}
          <Group>
            <GroupLabel>Type</GroupLabel>
            {KIND_OPTIONS.map((kind) => (
              <CheckboxRow key={kind}>
                <input
                  type="checkbox"
                  checked={search.kindFilter.includes(kind)}
                  onChange={() => search.toggleKind(kind)}
                  data-testid={`library-filter-kind-${kind}`}
                />
                {kind}s
              </CheckboxRow>
            ))}
          </Group>
          <Group>
            <GroupLabel>Sort</GroupLabel>
            <SortSelect
              value={search.sort}
              onChange={(e) => search.setSort(e.target.value as LibrarySort)}
              data-testid="library-filter-sort"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SortSelect>
          </Group>
          <ClearAllButton
            type="button"
            disabled={!search.hasActiveFilters && !search.isSearching}
            onClick={search.clearAll}
            data-testid="library-filter-clear"
          >
            Clear all
          </ClearAllButton>
        </FilterBody>
      </SheetContent>
    </Sheet>
  );
};

FilterSheet.displayName = 'FilterSheet';
export default FilterSheet;
