import React, { useEffect, memo, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { FixedSizeList as List } from 'react-window';
import { DEFAULT_GLOW_RATE } from './AccentColorGlowOverlay';
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
    grayscale: number;
    invert: number;
  };
  onFilterChange: (filterName: string, value: number | boolean) => void;
  onResetFilters: () => void;
  // Glow controls
  glowEnabled: boolean;
  setGlowEnabled: (v: boolean) => void;
  glowIntensity: number;
  setGlowIntensity: (v: number) => void;
  glowRate: number;
  setGlowRate: (v: number) => void;
  glowMode: 'global' | 'per-album';
  setGlowMode: (v: 'global' | 'per-album') => void;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  setPerAlbumGlow: (v: Record<string, { intensity: number; rate: number }>) => void;
  currentAlbumId: string;
  currentAlbumName: string;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

const ControlValue = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
`;

const Slider = styled.input<{ $accentColor: string }>`
  appearance: none;
  width: 100%;
  height: 4px;
  background: ${theme.colors.control.background};
  border-radius: ${theme.borderRadius.sm};
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${({ $accentColor }: { $accentColor: string }) => $accentColor};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${({ $accentColor }: { $accentColor: string }) => $accentColor}33;
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: ${({ $accentColor }: { $accentColor: string }) => $accentColor};
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }
  
  &::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px ${({ $accentColor }: { $accentColor: string }) => $accentColor}33;
  }
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
  height: 300px; /* Fixed height for virtualization - optimized for ~5 visible items */
  width: 100%;
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

const ToggleButton = styled.button<{ $accentColor: string; $isActive: boolean }>`
  background: ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.muted.background};
  border: 1px solid ${({ $isActive, $accentColor }: { $isActive: boolean; $accentColor: string }) => $isActive ? $accentColor : theme.colors.border};
  color: ${({ $isActive }: { $isActive: boolean }) => $isActive ? theme.colors.black : theme.colors.muted.foreground};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  transition: all 0.2s ease;
  
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
    prevProps.glowEnabled !== nextProps.glowEnabled ||
    prevProps.glowIntensity !== nextProps.glowIntensity ||
    prevProps.glowRate !== nextProps.glowRate ||
    prevProps.glowMode !== nextProps.glowMode ||
    prevProps.currentAlbumId !== nextProps.currentAlbumId ||
    prevProps.currentAlbumName !== nextProps.currentAlbumName
  ) {
    return false;
  }
  
  // Check filters object
  const filterKeys: (keyof typeof prevProps.filters)[] = [
    'brightness', 'contrast', 'saturation', 'hue', 'sepia', 'grayscale', 'invert'
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
  
  // Check perAlbumGlow - shallow comparison for performance
  const prevKeys = Object.keys(prevProps.perAlbumGlow);
  const nextKeys = Object.keys(nextProps.perAlbumGlow);
  
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }
  
  for (const key of prevKeys) {
    if (
      !nextProps.perAlbumGlow[key] ||
      prevProps.perAlbumGlow[key].intensity !== nextProps.perAlbumGlow[key].intensity ||
      prevProps.perAlbumGlow[key].rate !== nextProps.perAlbumGlow[key].rate
    ) {
      return false;
    }
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
  glowEnabled,
  setGlowEnabled,
  glowIntensity,
  setGlowIntensity,
  glowRate,
  setGlowRate,
  glowMode,
  setGlowMode,
  perAlbumGlow,
  setPerAlbumGlow,
  currentAlbumId,
  currentAlbumName,
  effectiveGlow
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

  // Memoized filter configuration for optimal virtual scrolling performance
  const filterConfig = useMemo(() => [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, unit: '%' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, unit: '%' },
    { key: 'saturation', label: 'Saturation', min: 0, max: 300, unit: '%' },
    { key: 'hue', label: 'Hue Rotate', min: 0, max: 360, unit: '°' },
    { key: 'sepia', label: 'Sepia', min: 0, max: 100, unit: '%' },
    { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, unit: '%' },
    { key: 'invert', label: 'Invert', min: 0, max: 1, unit: '', type: 'toggle' as const }
  ], []);

  // Optimized callbacks with minimal dependencies
  const handleInvertToggle = useCallback(() => {
    onFilterChange('invert', filters.invert === 0 ? 1 : 0);
  }, [filters.invert, onFilterChange]);

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
    const { key, label, min, max, unit, type } = config;
    
    // Use optimized filter value getter
    const currentValue = getFilterValue(key);
    
    if (type === 'toggle') {
      return (
        <div style={style} key={`filter-${key}`}>
          <FilterItem>
            <ControlGroup>
              <ControlLabel>
                {label}
                <ToggleButton
                  $accentColor={accentColor}
                  $isActive={currentValue === 1}
                  onClick={handleInvertToggle}
                  aria-label={`Toggle ${label}`}
                >
                  {currentValue === 1 ? 'On' : 'Off'}
                </ToggleButton>
              </ControlLabel>
            </ControlGroup>
          </FilterItem>
        </div>
      );
    }

    return (
      <div style={style} key={`filter-${key}`}>
        <FilterItem>
          <ControlGroup>
            <ControlLabel>
              {label}
              <ControlValue>{currentValue}{unit}</ControlValue>
            </ControlLabel>
            <Slider
              type="range"
              min={min}
              max={max}
              value={currentValue}
              onChange={(e) => handleFilterChange(key, parseInt(e.target.value))}
              $accentColor={accentColor}
              aria-label={`Adjust ${label}`}
            />
          </ControlGroup>
        </FilterItem>
      </div>
    );
  }, [filterConfig, accentColor, handleInvertToggle, handleFilterChange, getFilterValue]);

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
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
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
                  Enable Glow
                  <ToggleButton
                    $accentColor={accentColor}
                    $isActive={glowEnabled}
                    onClick={() => setGlowEnabled(!glowEnabled)}
                  >
                    {glowEnabled ? 'On' : 'Off'}
                  </ToggleButton>
                </ControlLabel>
              </ControlGroup>
              {glowEnabled && (
                <>
                  <ControlGroup>
                    <ControlLabel>
                      Glow Mode
                      <ToggleButton
                        $accentColor={accentColor}
                        $isActive={glowMode === 'per-album'}
                        onClick={() => setGlowMode(glowMode === 'global' ? 'per-album' : 'global')}
                      >
                        {glowMode === 'per-album' ? 'Per Album' : 'Global'}
                      </ToggleButton>
                    </ControlLabel>
                  </ControlGroup>
                  {glowMode === 'per-album' && currentAlbumId ? (
                    <>
                      <ControlGroup>
                        <ControlLabel>
                          Album Glow Intensity
                          <ControlValue>{(perAlbumGlow[currentAlbumId]?.intensity ?? 100)}</ControlValue>
                        </ControlLabel>
                        <Slider
                          type="range"
                          min={0}
                          max={100}
                          value={perAlbumGlow[currentAlbumId]?.intensity ?? 100}
                          onChange={e => {
                            setPerAlbumGlow({
                              ...perAlbumGlow,
                              [currentAlbumId]: {
                                intensity: Number(e.target.value),
                                rate: perAlbumGlow[currentAlbumId]?.rate ?? DEFAULT_GLOW_RATE
                              }
                            });
                          }}
                          $accentColor={accentColor}
                        />
                      </ControlGroup>
                      <ControlGroup>
                        <ControlLabel>
                          Album Glow Rate
                          <ControlValue>{(perAlbumGlow[currentAlbumId]?.rate ?? DEFAULT_GLOW_RATE).toFixed(2)}s</ControlValue>
                        </ControlLabel>
                        <Slider
                          type="range"
                          min={0.5}
                          max={5}
                          step={0.01}
                          value={perAlbumGlow[currentAlbumId]?.rate ?? DEFAULT_GLOW_RATE}
                          onChange={e => {
                            setPerAlbumGlow({
                              ...perAlbumGlow,
                              [currentAlbumId]: {
                                intensity: perAlbumGlow[currentAlbumId]?.intensity ?? 100,
                                rate: Number(e.target.value)
                              }
                            });
                          }}
                          $accentColor={accentColor}
                        />
                      </ControlGroup>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem' }}>
                        Album: {currentAlbumName || currentAlbumId}
                      </div>
                    </>
                  ) : (
                    <>
                      <ControlGroup>
                        <ControlLabel>
                          Glow Intensity
                          <ControlValue>{glowIntensity}</ControlValue>
                        </ControlLabel>
                        <Slider
                          type="range"
                          min={0}
                          max={100}
                          value={glowIntensity}
                          onChange={e => setGlowIntensity(Number(e.target.value))}
                          $accentColor={accentColor}
                        />
                      </ControlGroup>
                      <ControlGroup>
                        <ControlLabel>
                          Glow Rate
                          <ControlValue>{glowRate.toFixed(2)}s</ControlValue>
                        </ControlLabel>
                        <Slider
                          type="range"
                          min={0.5}
                          max={5}
                          step={0.01}
                          value={glowRate}
                          onChange={e => setGlowRate(Number(e.target.value))}
                          $accentColor={accentColor}
                        />
                      </ControlGroup>
                    </>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem' }}>
                    Effective: Intensity {effectiveGlow.intensity}, Rate {effectiveGlow.rate.toFixed(2)}s
                  </div>
                </>
              )}
            </FilterGrid>
          </FilterSection>
          {/* Album Art Filters Section */}
          <FilterSection>
            <SectionTitle>Album Art Filters</SectionTitle>
            <VirtualListContainer data-testid="filter-scroll-container">
              <List
                height={300}
                itemCount={filterConfig.length}
                itemSize={60}
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