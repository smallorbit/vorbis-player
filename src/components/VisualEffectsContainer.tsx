import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { useVisualEffectsState } from '../hooks/useVisualEffectsState';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));

interface AlbumArtFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}

interface VisualEffectsContainerProps {
  enabled: boolean;
  isMenuOpen: boolean;
  accentColor: string;
  filters: AlbumArtFilters;
  onMenuClose: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onToggleEffects: () => void;
}

interface EffectsPreset {
  id: string;
  name: string;
  filters: AlbumArtFilters;
  glow: { intensity: number; rate: number };
}

interface VisualEffectsState {
  glow: {
    intensity: number;
    rate: number;
    enabled: boolean;
  };
  filters: AlbumArtFilters;
  menu: {
    isOpen: boolean;
    activeTab: string;
  };
}

const DEFAULT_PRESETS: EffectsPreset[] = [
  {
    id: 'default',
    name: 'Default',
    filters: { brightness: 110, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 },
    glow: { intensity: 50, rate: 2 }
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    filters: { brightness: 120, contrast: 110, saturation: 130, hue: 0, blur: 0, sepia: 0 },
    glow: { intensity: 70, rate: 3 }
  },
  {
    id: 'vintage',
    name: 'Vintage',
    filters: { brightness: 95, contrast: 105, saturation: 80, hue: 15, blur: 1, sepia: 30 },
    glow: { intensity: 30, rate: 1 }
  }
];

const EffectsLoadingFallback: React.FC = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: '350px',
    height: '100vh',
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px'
  }}>
    Loading effects...
  </div>
);

const VisualEffectsContainer: React.FC<VisualEffectsContainerProps> = ({
  enabled,
  isMenuOpen,
  accentColor,
  filters,
  onMenuClose,
  onFilterChange,
  onResetFilters,
  onToggleEffects
}) => {
  const {
    glowIntensity,
    glowRate,
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings
  } = useVisualEffectsState();

  const [effectsState, setEffectsState] = useState<VisualEffectsState>({
    glow: { intensity: 50, rate: 2, enabled },
    filters,
    menu: { isOpen: isMenuOpen, activeTab: 'filters' }
  });

  const [performanceMetrics, setPerformanceMetrics] = useState<{
    renderTime: number;
    filterApplicationTime: number;
    glowRenderTime: number;
  }>({
    renderTime: 0,
    filterApplicationTime: 0,
    glowRenderTime: 0
  });

  // Sync with props
  useEffect(() => {
    setEffectsState((prev: VisualEffectsState) => ({
      ...prev,
      glow: { ...prev.glow, enabled },
      menu: { ...prev.menu, isOpen: isMenuOpen }
    }));
  }, [enabled, isMenuOpen]);

  // Apply preset
  const applyPreset = useCallback((preset: EffectsPreset) => {
    // Apply filters
    Object.entries(preset.filters).forEach(([filter, value]) => {
      onFilterChange(filter, value);
    });

    // Apply glow settings
    handleGlowIntensityChange(preset.glow.intensity);
    handleGlowRateChange(preset.glow.rate);
  }, [onFilterChange, handleGlowIntensityChange, handleGlowRateChange]);

  // Save custom preset
  const saveCustomPreset = useCallback((name: string) => {
    const customPreset: EffectsPreset = {
      id: `custom-${Date.now()}`,
      name,
      filters,
      glow: { intensity: glowIntensity, rate: glowRate }
    };

    const savedPresets = JSON.parse(
      localStorage.getItem('vorbis-player-custom-presets') || '[]'
    );

    savedPresets.push(customPreset);
    localStorage.setItem('vorbis-player-custom-presets', JSON.stringify(savedPresets));
  }, [filters, glowIntensity, glowRate]);

  // Performance monitoring
  const measureFilterPerformance = useCallback((filterName: string, value: number) => {
    const startTime = performance.now();

    onFilterChange(filterName, value);

    requestAnimationFrame(() => {
      const endTime = performance.now();
      setPerformanceMetrics((prev: { renderTime: number; filterApplicationTime: number; glowRenderTime: number }) => ({
        ...prev,
        filterApplicationTime: endTime - startTime
      }));
    });
  }, [onFilterChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.code) {
        case 'KeyV':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onToggleEffects();
          }
          break;
        case 'KeyE':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onMenuClose();
          }
          break;
        case 'KeyR':
          if (event.ctrlKey || event.metaKey && enabled) {
            event.preventDefault();
            onResetFilters();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onToggleEffects, onMenuClose, onResetFilters]);

  return enabled ? (
    <Suspense fallback={<EffectsLoadingFallback />}>
      <VisualEffectsMenu
        isOpen={isMenuOpen}
        onClose={onMenuClose}
        accentColor={accentColor}
        filters={filters}
        onFilterChange={measureFilterPerformance}
        onResetFilters={onResetFilters}
        glowIntensity={glowIntensity}
        setGlowIntensity={handleGlowIntensityChange}
        glowRate={glowRate}
        setGlowRate={handleGlowRateChange}
        effectiveGlow={effectiveGlow}
      />
    </Suspense>
  ) : null;
};

export default VisualEffectsContainer;