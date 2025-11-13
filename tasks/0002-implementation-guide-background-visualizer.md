# Implementation Guide: Background Visualizer

## Quick Start

This guide provides step-by-step instructions for implementing the background visualizer feature.

## Phase 1: Foundation Setup

### Step 1: Extend usePlayerState Hook

**File:** `src/hooks/usePlayerState.ts`

Add visualizer state properties:
```typescript
// Add to state declarations
const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useState<boolean>(() => {
  const saved = localStorage.getItem('vorbis-player-background-visualizer-enabled');
  return saved ? JSON.parse(saved) : false;
});

const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useState<VisualizerStyle>(() => {
  const saved = localStorage.getItem('vorbis-player-background-visualizer-style');
  return (saved as VisualizerStyle) || 'particles';
});

const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useState<number>(() => {
  const saved = localStorage.getItem('vorbis-player-background-visualizer-intensity');
  return saved ? parseInt(saved, 10) : 60;
});

// Add localStorage persistence
useEffect(() => {
  localStorage.setItem('vorbis-player-background-visualizer-enabled', JSON.stringify(backgroundVisualizerEnabled));
}, [backgroundVisualizerEnabled]);

useEffect(() => {
  localStorage.setItem('vorbis-player-background-visualizer-style', backgroundVisualizerStyle);
}, [backgroundVisualizerStyle]);

useEffect(() => {
  localStorage.setItem('vorbis-player-background-visualizer-intensity', backgroundVisualizerIntensity.toString());
}, [backgroundVisualizerIntensity]);

// Add to return object
return {
  // ... existing state
  backgroundVisualizerEnabled,
  setBackgroundVisualizerEnabled,
  backgroundVisualizerStyle,
  setBackgroundVisualizerStyle,
  backgroundVisualizerIntensity,
  setBackgroundVisualizerIntensity,
};
```

### Step 2: Create Type Definitions

**File:** `src/types/visualizer.d.ts`

```typescript
export type VisualizerStyle = 
  | 'particles'
  | 'waveform'
  | 'geometric'
  | 'gradient-flow';

export interface VisualizerConfig {
  particleCount?: number;
  animationSpeed?: number;
  colorVariation?: number;
  barCount?: number;
  shapeCount?: number;
  layerCount?: number;
}
```

### Step 3: Create BackgroundVisualizer Component

**File:** `src/components/BackgroundVisualizer.tsx`

```typescript
import React, { useMemo } from 'react';
import styled from 'styled-components';
import { ParticleVisualizer } from './visualizers/ParticleVisualizer';
import { WaveformVisualizer } from './visualizers/WaveformVisualizer';
import { GeometricVisualizer } from './visualizers/GeometricVisualizer';
import { GradientFlowVisualizer } from './visualizers/GradientFlowVisualizer';
import type { VisualizerStyle } from '../types/visualizer';

interface BackgroundVisualizerProps {
  enabled: boolean;
  style: VisualizerStyle;
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

const VisualizerContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
`;

export const BackgroundVisualizer: React.FC<BackgroundVisualizerProps> = ({
  enabled,
  style,
  intensity,
  accentColor,
  isPlaying,
  playbackPosition
}) => {
  const VisualizerComponent = useMemo(() => {
    if (!enabled) return null;
    
    switch (style) {
      case 'particles':
        return ParticleVisualizer;
      case 'waveform':
        return WaveformVisualizer;
      case 'geometric':
        return GeometricVisualizer;
      case 'gradient-flow':
        return GradientFlowVisualizer;
      default:
        return ParticleVisualizer;
    }
  }, [enabled, style]);

  if (!enabled || !VisualizerComponent) {
    return null;
  }

  return (
    <VisualizerContainer>
      <VisualizerComponent
        intensity={intensity}
        accentColor={accentColor}
        isPlaying={isPlaying}
        playbackPosition={playbackPosition}
      />
    </VisualizerContainer>
  );
};
```

### Step 4: Integrate into AudioPlayer

**File:** `src/components/AudioPlayer.tsx`

```typescript
// Add import
import { BackgroundVisualizer } from './BackgroundVisualizer';

// Add to AudioPlayerComponent, get visualizer state
const {
  // ... existing state
  backgroundVisualizerEnabled,
  backgroundVisualizerStyle,
  backgroundVisualizerIntensity,
} = usePlayerState();

// Get playback state (you may need to add this)
const [isPlaying, setIsPlaying] = useState(false);
const [playbackPosition, setPlaybackPosition] = useState(0);

// Add BackgroundVisualizer to render
return (
  <Container>
    <BackgroundVisualizer
      enabled={backgroundVisualizerEnabled}
      style={backgroundVisualizerStyle}
      intensity={backgroundVisualizerIntensity}
      accentColor={accentColor}
      isPlaying={isPlaying}
      playbackPosition={playbackPosition}
    />
    {renderContent()}
  </Container>
);
```

## Phase 2: Implement First Visualizer (Particles)

### Step 1: Create Particle Visualizer Component

**File:** `src/components/visualizers/ParticleVisualizer.tsx`

```typescript
import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationFrame } from '../hooks/useAnimationFrame';

interface ParticleVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
}

export const ParticleVisualizer: React.FC<ParticleVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Initialize particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const particleCount = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
    particlesRef.current = initializeParticles(particleCount, canvas.width, canvas.height, accentColor);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [accentColor]);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;

    // Update particles
    updateParticles(particlesRef.current, deltaTime, isPlaying, canvas.width, canvas.height);

    // Render particles
    renderParticles(ctx, particlesRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity]);

  useAnimationFrame(animate);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};

// Helper functions (implement based on technical design doc)
function initializeParticles(
  count: number,
  width: number,
  height: number,
  accentColor: string
): Particle[] {
  // Implementation from technical design
}

function updateParticles(
  particles: Particle[],
  deltaTime: number,
  isPlaying: boolean,
  width: number,
  height: number
): void {
  // Implementation from technical design
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  intensity: number
): void {
  // Implementation from technical design
}
```

### Step 2: Create useAnimationFrame Hook

**File:** `src/hooks/useAnimationFrame.ts`

```typescript
import { useEffect, useRef } from 'react';

export function useAnimationFrame(callback: (time: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        callback(time);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback]);
}
```

## Phase 3: Add UI Controls

### Step 1: Add Controls to VisualEffectsMenu

**File:** `src/components/VisualEffectsMenu.tsx`

```typescript
// Add props
interface VisualEffectsMenuProps {
  // ... existing props
  backgroundVisualizerEnabled: boolean;
  setBackgroundVisualizerEnabled: (enabled: boolean) => void;
  backgroundVisualizerStyle: VisualizerStyle;
  setBackgroundVisualizerStyle: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity: number;
  setBackgroundVisualizerIntensity: (intensity: number) => void;
}

// Add to component
<FilterSection>
  <SectionTitle>Background Visualizer</SectionTitle>
  <FilterGrid>
    <ControlGroup>
      <ControlLabel>
        Enable Visualizer
      </ControlLabel>
      <OptionButtonGroup>
        <OptionButton
          $accentColor={accentColor}
          $isActive={backgroundVisualizerEnabled}
          onClick={() => setBackgroundVisualizerEnabled(!backgroundVisualizerEnabled)}
        >
          {backgroundVisualizerEnabled ? 'On' : 'Off'}
        </OptionButton>
      </OptionButtonGroup>
    </ControlGroup>

    {backgroundVisualizerEnabled && (
      <>
        <ControlGroup>
          <ControlLabel>Style</ControlLabel>
          <OptionButtonGroup>
            {['particles', 'waveform', 'geometric', 'gradient-flow'].map((style) => (
              <OptionButton
                key={style}
                $accentColor={accentColor}
                $isActive={backgroundVisualizerStyle === style}
                onClick={() => setBackgroundVisualizerStyle(style as VisualizerStyle)}
              >
                {style.charAt(0).toUpperCase() + style.slice(1).replace('-', ' ')}
              </OptionButton>
            ))}
          </OptionButtonGroup>
        </ControlGroup>

        <ControlGroup>
          <ControlLabel>
            Intensity: {backgroundVisualizerIntensity}%
          </ControlLabel>
          {/* Add slider component */}
        </ControlGroup>
      </>
    )}
  </FilterGrid>
</FilterSection>
```

### Step 2: Pass Props Through Component Tree

**File:** `src/components/AudioPlayer.tsx`

```typescript
// Pass visualizer state to VisualEffectsContainer
<VisualEffectsContainer
  // ... existing props
  backgroundVisualizerEnabled={backgroundVisualizerEnabled}
  setBackgroundVisualizerEnabled={setBackgroundVisualizerEnabled}
  backgroundVisualizerStyle={backgroundVisualizerStyle}
  setBackgroundVisualizerStyle={setBackgroundVisualizerStyle}
  backgroundVisualizerIntensity={backgroundVisualizerIntensity}
  setBackgroundVisualizerIntensity={setBackgroundVisualizerIntensity}
/>
```

## Phase 4: Additional Visualizers

Follow the same pattern as ParticleVisualizer for:
1. WaveformVisualizer
2. GeometricVisualizer
3. GradientFlowVisualizer

Use the algorithms from the technical design document.

## Phase 5: Polish & Optimization

### Performance Checklist
- [ ] Implement frame rate limiting
- [ ] Add visibility API pause/resume
- [ ] Optimize particle/shape counts for mobile
- [ ] Add GPU acceleration hints
- [ ] Test memory leaks

### Color Utilities

**File:** `src/utils/visualizerUtils.ts`

```typescript
export function generateColorVariant(baseColor: string, variation: number): string {
  // Implementation from technical design
}

export function adjustColorBrightness(color: string, amount: number): string {
  // Implementation from technical design
}

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Implementation
}

function rgbToHex(r: number, g: number, b: number): string {
  // Implementation
}
```

## Testing Checklist

- [ ] Unit tests for color utilities
- [ ] Unit tests for particle physics
- [ ] Integration tests for state management
- [ ] Visual regression tests
- [ ] Performance profiling
- [ ] Cross-browser testing
- [ ] Mobile device testing

## Common Issues & Solutions

### Issue: Performance problems on mobile
**Solution:** Reduce particle/shape counts, implement adaptive quality

### Issue: Visualizer not visible
**Solution:** Check z-index, ensure intensity > 0, verify canvas is rendering

### Issue: Colors not updating
**Solution:** Ensure accentColor prop is passed correctly, check color utility functions

### Issue: Animation stuttering
**Solution:** Use requestAnimationFrame properly, implement frame rate limiting

## Next Steps After Implementation

1. Gather user feedback
2. Add more visualizer styles if desired
3. Consider adding visualizer presets
4. Optimize based on performance metrics
5. Add accessibility features (reduce motion support)

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Implementation Guide

