import React, { Suspense, lazy, useEffect } from 'react';
import type { VisualizerStyle } from '../types/visualizer';
import type { AlbumFilters } from '../types/filters';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));

interface VisualEffectsContainerProps {
  enabled: boolean;
  isMenuOpen: boolean;
  accentColor: string;
  filters: AlbumFilters;
  onMenuClose: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onToggleEffects: () => void;
  // Glow controls from parent
  glowIntensity: number;
  setGlowIntensity: (intensity: number) => void;
  glowRate: number;
  setGlowRate: (rate: number) => void;
  effectiveGlow: { intensity: number; rate: number };
  // Background visualizer controls
  backgroundVisualizerStyle: VisualizerStyle;
  onBackgroundVisualizerStyleChange: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity: number;
  onBackgroundVisualizerIntensityChange: (intensity: number) => void;
  accentColorBackgroundEnabled: boolean;
  onAccentColorBackgroundToggle: () => void;
}

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
  // enabled prop not used for menu visibility, but kept for API compatibility
  isMenuOpen,
  accentColor,
  filters,
  onMenuClose,
  onFilterChange,
  onResetFilters,
  onToggleEffects,
  glowIntensity,
  setGlowIntensity,
  glowRate,
  setGlowRate,
  effectiveGlow,
  backgroundVisualizerStyle,
  onBackgroundVisualizerStyleChange,
  backgroundVisualizerIntensity,
  onBackgroundVisualizerIntensityChange,
  accentColorBackgroundEnabled,
  onAccentColorBackgroundToggle
}) => {



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
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onResetFilters();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToggleEffects, onMenuClose, onResetFilters]);

  // Wrapper function to handle type mismatch between onFilterChange signatures
  const handleFilterChangeWrapper = (filterName: string, value: number | boolean) => {
    if (typeof value === 'number') {
      onFilterChange(filterName, value);
    }
    // Ignore boolean values for now as they're not used in the current implementation
  };

  // Always render menu when open, regardless of enabled state
  // The enabled prop controls whether effects are applied, not menu accessibility
  return isMenuOpen ? (
    <Suspense fallback={<EffectsLoadingFallback />}>
      <VisualEffectsMenu
        isOpen={isMenuOpen}
        onClose={onMenuClose}
        accentColor={accentColor}
        filters={filters}
        onFilterChange={handleFilterChangeWrapper}
        onResetFilters={onResetFilters}
        glowIntensity={glowIntensity}
        setGlowIntensity={setGlowIntensity}
        glowRate={glowRate}
        setGlowRate={setGlowRate}
        effectiveGlow={effectiveGlow}
        backgroundVisualizerStyle={backgroundVisualizerStyle}
        onBackgroundVisualizerStyleChange={onBackgroundVisualizerStyleChange}
        backgroundVisualizerIntensity={backgroundVisualizerIntensity}
        onBackgroundVisualizerIntensityChange={onBackgroundVisualizerIntensityChange}
        accentColorBackgroundEnabled={accentColorBackgroundEnabled}
        onAccentColorBackgroundToggle={onAccentColorBackgroundToggle}
      />
    </Suspense>
  ) : null;
};

export default VisualEffectsContainer;