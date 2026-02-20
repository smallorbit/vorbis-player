import React, { memo, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

import { theme } from '../../styles/theme';
import { PerformanceProfilerComponent } from '../PerformanceProfiler';
import VisualEffectsPerformanceMonitor from '../VisualEffectsPerformanceMonitor';
import { usePlayerSizing } from '../../hooks/usePlayerSizing';
import type { VisualizerStyle } from '../../types/visualizer';

import {
  DrawerOverlay,
  DrawerContainer,
  DrawerHeader,
  DrawerTitle,
  CloseButton,
  DrawerContent,
  FilterSection,
  SectionTitle,
  FilterGrid,
  ControlGroup,
  ControlLabel,
  OptionButtonGroup,
  OptionButton,
  IntensityValue,
  IntensitySlider,
  VirtualListContainer,
  FilterItem,
  ResetButton
} from './styled';

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
  onFilterChange: (filterName: string, value: number) => void;
  onResetFilters: () => void;
  // Glow controls
  glowIntensity: number;
  setGlowIntensity: (v: number) => void;
  glowRate: number;
  setGlowRate: (v: number) => void;
  effectiveGlow: { intensity: number; rate: number };
  // Background visualizer controls
  backgroundVisualizerStyle: VisualizerStyle;
  onBackgroundVisualizerStyleChange: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity: number;
  onBackgroundVisualizerIntensityChange: (intensity: number) => void;
  accentColorBackgroundEnabled: boolean;
  onAccentColorBackgroundToggle: () => void;
}

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

  // Check background visualizer props
  if (
    prevProps.backgroundVisualizerStyle !== nextProps.backgroundVisualizerStyle ||
    prevProps.backgroundVisualizerIntensity !== nextProps.backgroundVisualizerIntensity ||
    prevProps.accentColorBackgroundEnabled !== nextProps.accentColorBackgroundEnabled
  ) {
    return false;
  }

  return true;
};

const VisualEffectsMenu: React.FC<VisualEffectsMenuProps> = memo(({
  isOpen,
  onClose,
  accentColor,
  filters,
  onFilterChange,
  onResetFilters,
  glowIntensity,
  setGlowIntensity,
  glowRate,
  setGlowRate,
  backgroundVisualizerStyle,
  onBackgroundVisualizerStyleChange,
  backgroundVisualizerIntensity,
  onBackgroundVisualizerIntensityChange,
  accentColorBackgroundEnabled,
  onAccentColorBackgroundToggle
}) => {
  // Get responsive sizing information
  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  // Calculate responsive width for the drawer
  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs));
    if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet));
    return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop));
  }, [viewport.width, isMobile, isTablet]);

  // Note: Keyboard shortcuts (Escape key) are handled in PlayerContent via useKeyboardShortcuts

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
        isEnabled={import.meta.env.DEV}
      />
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
      <DrawerContainer
        $isOpen={isOpen}
        $width={drawerWidth}
        $transitionDuration={transitionDuration}
        $transitionEasing={transitionEasing}
      >
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
              <ControlGroup>
                <ControlLabel>
                  Accent Color Background
                </ControlLabel>
                <OptionButtonGroup>
                  <OptionButton
                    $accentColor={accentColor}
                    $isActive={accentColorBackgroundEnabled}
                    onClick={onAccentColorBackgroundToggle}
                  >
                    {accentColorBackgroundEnabled ? 'On' : 'Off'}
                  </OptionButton>
                </OptionButtonGroup>
              </ControlGroup>
            </FilterGrid>
          </FilterSection>
          
          {/* Background Visualizer Options Section */}
          <FilterSection>
            <SectionTitle>Background Visualizer</SectionTitle>
            <FilterGrid>
              <ControlGroup>
                <ControlLabel>
                  Visualizer Style
                </ControlLabel>
                <OptionButtonGroup>
                  {(['particles', 'geometric'] as VisualizerStyle[]).map((style) => (
                    <OptionButton
                      key={style}
                      $accentColor={accentColor}
                      $isActive={backgroundVisualizerStyle === style}
                      onClick={() => onBackgroundVisualizerStyleChange(style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </OptionButton>
                  ))}
                </OptionButtonGroup>
              </ControlGroup>
              
              <ControlGroup>
                <ControlLabel style={{ justifyContent: 'space-between' }}>
                  <span>Visualizer Intensity</span>
                  <IntensityValue>{backgroundVisualizerIntensity}%</IntensityValue>
                </ControlLabel>
                <IntensitySlider
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={backgroundVisualizerIntensity}
                  onChange={(e) => onBackgroundVisualizerIntensityChange(parseInt(e.target.value))}
                  $accentColor={accentColor}
                  style={{
                    '--slider-value': `${backgroundVisualizerIntensity}%`
                  } as React.CSSProperties}
                />
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

