import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import type { ProviderId } from '@/types/domain';

interface FilterSidebarProps {
  collectionType: 'playlists' | 'albums';
  onCollectionTypeChange: (type: 'playlists' | 'albums') => void;
  enabledProviderIds: ProviderId[];
  selectedProviderIds: ProviderId[];
  onProviderFilterChange: (providerIds: ProviderId[]) => void;
  showProviderFilter: boolean;
}

const SidebarContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$isExpanded'].includes(prop),
})<{ $isExpanded: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  padding: ${theme.spacing.lg};
  background: rgba(20, 20, 20, 0.3);
  flex-shrink: 0;

  @media (min-width: ${theme.breakpoints.lg}) {
    border-right: 1px solid ${theme.colors.popover.border};
    min-width: 200px;
    position: static;
    height: auto;
    opacity: 1;
    pointer-events: auto;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    border-bottom: 1px solid ${theme.colors.popover.border};
    border-radius: 0 0 ${theme.borderRadius.lg} ${theme.borderRadius.lg};
    max-height: ${({ $isExpanded }) => ($isExpanded ? '70vh' : '0')};
    overflow: hidden;
    opacity: ${({ $isExpanded }) => ($isExpanded ? 1 : 0)};
    pointer-events: ${({ $isExpanded }) => ($isExpanded ? 'auto' : 'none')};
    transition: max-height ${theme.transitions.normal}, opacity ${theme.transitions.normal};
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

const MobileToggleButton = styled.button`
  display: none;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  align-items: center;
  gap: ${theme.spacing.xs};

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    color: ${theme.colors.white};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    display: flex;
  }
`;

const MobileToggleIcon = styled.span<{ $isExpanded: boolean }>`
  display: inline-block;
  transition: transform ${theme.transitions.fast};
  transform: rotate(${({ $isExpanded }) => ($isExpanded ? '180deg' : '0deg')});
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
  position: relative;
`;

export const FilterSidebar = ({
  collectionType,
  onCollectionTypeChange,
  enabledProviderIds,
  selectedProviderIds,
  onProviderFilterChange,
  showProviderFilter,
}: FilterSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    collectionType === 'albums' || selectedProviderIds.length > 0;

  const handleClearFilters = useCallback(() => {
    onCollectionTypeChange('playlists');
    onProviderFilterChange([]);
  }, [onCollectionTypeChange, onProviderFilterChange]);

  const handleProviderToggle = useCallback(
    (provider: ProviderId) => {
      if (selectedProviderIds.includes(provider)) {
        const next = selectedProviderIds.filter((p) => p !== provider);
        onProviderFilterChange(
          next.length === enabledProviderIds.length ? [] : next
        );
      } else {
        onProviderFilterChange([...selectedProviderIds, provider]);
      }
    },
    [selectedProviderIds, enabledProviderIds, onProviderFilterChange]
  );

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <Wrapper>
      <MobileToggleButton onClick={handleToggleExpand}>
        Filters
        <MobileToggleIcon $isExpanded={isExpanded}>▼</MobileToggleIcon>
      </MobileToggleButton>

      <SidebarContainer $isExpanded={isExpanded}>
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

        {hasActiveFilters && (
          <ClearFiltersButton onClick={handleClearFilters}>
            Clear Filters
          </ClearFiltersButton>
        )}
      </SidebarContainer>
    </Wrapper>
  );
};
