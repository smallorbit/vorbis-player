import React, { useEffect, memo, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { FixedSizeList as List } from 'react-window';

import { theme } from '../styles/theme';
import { PerformanceProfilerComponent } from './PerformanceProfiler';
import VisualEffectsPerformanceMonitor from './VisualEffectsPerformanceMonitor';

interface VisualEffectsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    sepia: number;
  };
  onFilterChange: (filterName: string, value: number | boolean) => void;
  onResetFilters: () => void;
  // Glow controls
  glowIntensity: number;
  setGlowIntensity: (v: number) => void;
  glowRate: number;
  setGlowRate: (v: number) => void;
  effectiveGlow: { intensity: number; rate: number };
}

const DrawerOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.overlay.light};
  z-index: ${theme.zIndex.overlay};
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-app-region: no-drag;
`;

const DrawerContainer = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${({ $isOpen }) => ($isOpen ? '0' : '100%')});
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  
  @media (max-width: ${theme.breakpoints.md}) {
    width: 100vw;
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const DrawerTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
  
  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const DrawerContent = styled.div`
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
`;


const FilterSection = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
  margin-top: 0.5rem;
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const FilterGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const VirtualListContainer = styled.div`
  width: 100%;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
  /* Hardware acceleration for smooth scrolling */
  transform: translateZ(0);
  will-change: scroll-position;
`;

const FilterItem = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
`;

const ResetButton = styled.button<{ $accentColor: string }>`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  width: 100%;
  margin-top: 0.75rem;
  
  &:hover {
    background: ${({ $accentColor }) => $accentColor}22;
    border-color: ${({ $accentColor }) => $accentColor}44;
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }
`;


const OptionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const OptionButton = styled.button<{ $accentColor: string; $isActive: boolean }>`
  background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.muted.background};
  border: 1px solid ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.border};
  color: ${({ $isActive }: { $isActive: boolean }) => $isActive ? theme.colors.black : theme.colors.muted.foreground};
  padding: 0.375rem 0.75rem;
  border-radius: ${theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: ${theme.fontWeight.medium};
  transition: all 0.2s ease;
  min-width: 60px;
  
  &:hover {
    background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor + 'DD' : $accentColor + '22'};
    border-color: ${({ $accentColor }: { $accentColor: string }) => $accentColor};
    color: ${({ $isActive }: { $isActive: boolean }) => $isActive ? theme.colors.black : theme.colors.white};
    transform: translateY(-1px);
  }
`;

// Custom comparison function for memo optimization
const areVisualEffectsPropsEqual = (
  prevProps: VisualEffectsMenuProps,
  nextProps: VisualEffectsMenuProps
): boolean => {
  // Check simple props first
  if (
    prevProps.isOpen !== nextProps.isOpen ||
    prevProps.accentColor !== nextProps.accentColor ||
    prevProps.glowIntensity !== nextProps.glowIntensity ||
    prevProps.glowRate !== nextProps.glowRate
  ) {
    return false;
  }

  // Check filters object
  const filterKeys: (keyof typeof prevProps.filters)[] = [
    'brightness', 'contrast', 'saturation', 'sepia'
  ];

  for (const key of filterKeys) {
    if (prevProps.filters[key] !== nextProps.filters[key]) {
      return false;
    }
  }

  // Check effective glow
  if (
    prevProps.effectiveGlow.intensity !== nextProps.effectiveGlow.intensity ||
    prevProps.effectiveGlow.rate !== nextProps.effectiveGlow.rate
  ) {
    return false;
  }



  return true;
};

export const VisualEffectsMenu: React.FC<VisualEffectsMenuProps> = memo(({
  isOpen,
  onClose,
  accentColor,
  filters,
  onFilterChange,
  onResetFilters,
  glowIntensity,
  setGlowIntensity,
  glowRate,
  setGlowRate
}) => {
  // Add ESC key support to close the drawer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    // Only add event listener when drawer is open
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Simplified filter configuration with 3-option selections
  const filterConfig = useMemo(() => [
    {
      key: 'brightness',
      label: 'Brightness',
      type: 'options' as const,
      options: [
        { label: 'Less', value: 90 },
        { label: 'Normal', value: 100 },
        { label: 'More', value: 110 }
      ]
    },
    {
      key: 'saturation',
      label: 'Saturation',
      type: 'options' as const,
      options: [
        { label: 'Less', value: 80 },
        { label: 'Normal', value: 100 },
        { label: 'More', value: 120 }
      ]
    },
    {
      key: 'sepia',
      label: 'Sepia',
      type: 'options' as const,
      options: [
        { label: 'None', value: 0 },
        { label: 'Some', value: 20 },
        { label: 'More', value: 40 }
      ]
    },
    {
      key: 'contrast',
      label: 'Contrast',
      type: 'options' as const,
      options: [
        { label: 'Less', value: 85 },
        { label: 'Normal', value: 100 },
        { label: 'More', value: 115 }
      ]
    }
  ], []);

  // Glow intensity and rate option mappings
  const glowIntensityOptions = [
    { label: 'Less', value: 95 },
    { label: 'Normal', value: 110 },
    { label: 'More', value: 125 }
  ];

  const glowRateOptions = [
    { label: 'Slower', value: 5.0 },
    { label: 'Normal', value: 4.0 },
    { label: 'Faster', value: 3.0 }
  ];



  const handleFilterChange = useCallback((key: string, value: number) => {
    onFilterChange(key, value);
  }, [onFilterChange]);

  // Optimized filter value getter for performance
  const getFilterValue = useCallback((key: string) => {
    return filters[key as keyof typeof filters];
  }, [filters]);

  // Optimized render function for virtual list items with minimal re-renders
  const renderFilterItem = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const config = filterConfig[index];
    const { key, label, type } = config;

    // Use optimized filter value getter
    const currentValue = getFilterValue(key);

    if (type === 'options') {
      return (
        <div style={style} key={`filter-${key}`}>
          <FilterItem>
            <ControlGroup>
              <ControlLabel>
                {label}
                {/* <ControlValue>{getCurrentFilterOptionLabel(key, currentValue)}</ControlValue> */}
              </ControlLabel>
              <OptionButtonGroup>
                {config.options.map((option) => (
                  <OptionButton
                    key={`${key}-${option.value}`}
                    $accentColor={accentColor}
                    $isActive={currentValue === option.value}
                    onClick={() => handleFilterChange(key, option.value)}
                    aria-label={`Set ${label} to ${option.label}`}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </OptionButtonGroup>
            </ControlGroup>
          </FilterItem>
        </div>
      );
    }

    // Should not reach here since all filters are options type
    return null;
  }, [filterConfig, accentColor, handleFilterChange, getFilterValue]);

  return (
    <PerformanceProfilerComponent id="visual-effects-menu">
      <VisualEffectsPerformanceMonitor
        filterCount={filterConfig.length}
        isEnabled={process.env.NODE_ENV === 'development'}
      />
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
      <DrawerContainer $isOpen={isOpen}>
        <DrawerHeader>
          <DrawerTitle>Visual Effects</DrawerTitle>
          <CloseButton onClick={onClose} aria-label="Close visual effects drawer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </DrawerHeader>

        <DrawerContent>
          {/* Glow Controls Section */}
          <FilterSection>
            <SectionTitle>Glow Effect</SectionTitle>
            <FilterGrid>
              <ControlGroup>
                <ControlLabel>
                  Intensity
                  {/* <ControlValue>{getCurrentGlowIntensityLabel(glowIntensity)}</ControlValue> */}
                </ControlLabel>
                <OptionButtonGroup>
                  {glowIntensityOptions.map((option) => (
                    <OptionButton
                      key={`global-intensity-${option.value}`}
                      $accentColor={accentColor}
                      $isActive={glowIntensity === option.value}
                      onClick={() => setGlowIntensity(option.value)}
                    >
                      {option.label}
                    </OptionButton>
                  ))}
                </OptionButtonGroup>
              </ControlGroup>
              <ControlGroup>
                <ControlLabel>
                  Rate
                  {/* <ControlValue>{getCurrentGlowRateLabel(glowRate)}</ControlValue> */}
                </ControlLabel>
                <OptionButtonGroup>
                  {glowRateOptions.map((option) => (
                    <OptionButton
                      key={`global-rate-${option.value}`}
                      $accentColor={accentColor}
                      $isActive={glowRate === option.value}
                      onClick={() => setGlowRate(option.value)}
                    >
                      {option.label}
                    </OptionButton>
                  ))}
                </OptionButtonGroup>
              </ControlGroup>
            </FilterGrid>
          </FilterSection>
          <FilterSection>
            <SectionTitle>Album Art Filters</SectionTitle>
            <VirtualListContainer data-testid="filter-scroll-container">
              <List
                height={100 * filterConfig.length}
                itemCount={filterConfig.length}
                itemSize={90}
                itemData={filterConfig}
                overscanCount={1} // Pre-render 1 item outside visible area for smooth scrolling
                width="100%"
              >
                {renderFilterItem}
              </List>
            </VirtualListContainer>
            <ResetButton onClick={onResetFilters} $accentColor={accentColor}>
              Reset All Filters
            </ResetButton>
          </FilterSection>
        </DrawerContent>
      </DrawerContainer>
    </PerformanceProfilerComponent>
  );
}, areVisualEffectsPropsEqual);

VisualEffectsMenu.displayName = 'VisualEffectsMenu';

export default VisualEffectsMenu;