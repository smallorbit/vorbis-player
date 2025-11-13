# Technical Design: Background Visualizer Implementation

## Overview

This document provides detailed technical specifications for implementing the background visualizer feature, including specific algorithms, data structures, and implementation patterns for each visualizer style.

## Architecture

### Component Hierarchy

```
App
└── AudioPlayer
    └── BackgroundVisualizer (z-index: 1)
        └── [Visualizer Style Component] (Canvas or CSS)
    └── PlayerContent (z-index: 1000)
```

### State Flow

```
usePlayerState
  ├── backgroundVisualizerEnabled: boolean
  ├── backgroundVisualizerStyle: VisualizerStyle
  └── backgroundVisualizerIntensity: number (0-100)

BackgroundVisualizer Component
  ├── Reads state from usePlayerState
  ├── Passes props to selected visualizer style
  └── Manages canvas/container lifecycle

Visualizer Style Components
  ├── Receive: enabled, intensity, accentColor, isPlaying
  ├── Render animation using Canvas API or CSS
  └── Use requestAnimationFrame for updates
```

## Visualizer Styles - Detailed Specifications

### 1. Particle System Visualizer

#### Concept
Floating particles that drift across the screen, pulsing and changing opacity based on playback state. Particles use the accent color with variations.

#### Implementation Approach
- **Canvas API** for rendering
- Particle-based physics simulation
- GPU-accelerated transforms

#### Data Structure
```typescript
interface Particle {
  x: number;           // X position
  y: number;           // Y position
  vx: number;          // X velocity
  vy: number;          // Y velocity
  radius: number;      // Particle radius
  baseRadius: number;  // Base radius for pulsing
  opacity: number;     // Current opacity (0-1)
  baseOpacity: number;// Base opacity
  color: string;       // Particle color (accent color variant)
  pulsePhase: number;  // Phase for pulsing animation (0-2π)
  pulseSpeed: number;  // Speed of pulse animation
}

interface ParticleSystemConfig {
  particleCount: number;      // Number of particles
  minRadius: number;          // Minimum particle size
  maxRadius: number;          // Maximum particle size
  speedMultiplier: number;    // Overall speed (affected by intensity)
  pulseFrequency: number;     // How fast particles pulse
  colorVariation: number;     // Color variation range (0-1)
}
```

#### Algorithm
```typescript
// Initialize particles
function initializeParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: minRadius + Math.random() * (maxRadius - minRadius),
    baseRadius: minRadius + Math.random() * (maxRadius - minRadius),
    opacity: 0.3 + Math.random() * 0.4,
    baseOpacity: 0.3 + Math.random() * 0.4,
    color: generateColorVariant(accentColor, colorVariation),
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.01 + Math.random() * 0.02
  }));
}

// Update particles
function updateParticles(particles: Particle[], deltaTime: number, isPlaying: boolean): void {
  const speedMultiplier = isPlaying ? 1.0 : 0.3; // Slow down when paused
  
  particles.forEach(particle => {
    // Update position
    particle.x += particle.vx * speedMultiplier;
    particle.y += particle.vy * speedMultiplier;
    
    // Wrap around screen edges
    if (particle.x < 0) particle.x = canvasWidth;
    if (particle.x > canvasWidth) particle.x = 0;
    if (particle.y < 0) particle.y = canvasHeight;
    if (particle.y > canvasHeight) particle.y = 0;
    
    // Update pulse phase
    particle.pulsePhase += particle.pulseSpeed * speedMultiplier;
    if (particle.pulsePhase > Math.PI * 2) particle.pulsePhase -= Math.PI * 2;
    
    // Calculate pulsing radius and opacity
    const pulseValue = Math.sin(particle.pulsePhase);
    particle.radius = particle.baseRadius + pulseValue * 2;
    particle.opacity = particle.baseOpacity + pulseValue * 0.2;
  });
}

// Render particles
function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[], intensity: number): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  particles.forEach(particle => {
    ctx.save();
    ctx.globalAlpha = particle.opacity * (intensity / 100);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}
```

#### Performance Optimizations
- Adjust particle count based on viewport size
- Use `requestAnimationFrame` with delta time calculation
- Batch canvas operations
- Reduce particle count on mobile devices

---

### 2. Waveform Bars Visualizer

#### Concept
Vertical bars that simulate audio waveform visualization. Bars animate with a simulated rhythm pattern, pulsing and changing height.

#### Implementation Approach
- **Canvas API** for rendering
- Pre-defined rhythm patterns (not true audio analysis)
- Smooth bar height transitions

#### Data Structure
```typescript
interface WaveformBar {
  x: number;              // X position
  width: number;          // Bar width
  targetHeight: number;   // Target height (for smooth transitions)
  currentHeight: number;  // Current height
  color: string;          // Bar color
  phase: number;          // Phase offset for animation
}

interface WaveformConfig {
  barCount: number;           // Number of bars
  barWidth: number;            // Width of each bar
  barSpacing: number;          // Space between bars
  minHeight: number;           // Minimum bar height (%)
  maxHeight: number;           // Maximum bar height (%)
  animationSpeed: number;      // Speed of height changes
  rhythmPattern: number[];     // Pre-defined rhythm pattern (0-1)
}
```

#### Algorithm
```typescript
// Initialize waveform bars
function initializeWaveformBars(count: number, width: number): WaveformBar[] {
  const barWidth = 4;
  const barSpacing = 2;
  const totalBarWidth = barWidth + barSpacing;
  const startX = (width - (count * totalBarWidth - barSpacing)) / 2;
  
  // Pre-defined rhythm pattern (simulates musical rhythm)
  const rhythmPattern = generateRhythmPattern(count);
  
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * totalBarWidth,
    width: barWidth,
    targetHeight: rhythmPattern[i] * maxHeight,
    currentHeight: rhythmPattern[i] * maxHeight,
    color: generateColorVariant(accentColor, i / count),
    phase: (i / count) * Math.PI * 2
  }));
}

// Generate rhythm pattern (simulates musical beats)
function generateRhythmPattern(count: number): number[] {
  const pattern: number[] = [];
  const beats = [0.2, 0.4, 0.6, 0.8, 1.0, 0.9, 0.7, 0.5]; // Simulated beat pattern
  
  for (let i = 0; i < count; i++) {
    const beatIndex = i % beats.length;
    const variation = 0.1 + Math.random() * 0.2; // Add randomness
    pattern.push(beats[beatIndex] * variation);
  }
  
  return pattern;
}

// Update waveform bars
function updateWaveformBars(
  bars: WaveformBar[], 
  deltaTime: number, 
  isPlaying: boolean,
  playbackPosition: number
): void {
  const speedMultiplier = isPlaying ? 1.0 : 0.2;
  const time = playbackPosition / 1000; // Convert to seconds
  
  bars.forEach((bar, index) => {
    // Calculate target height based on rhythm pattern and time
    const rhythmValue = Math.sin((time * 2 + bar.phase) * Math.PI);
    const patternValue = generateRhythmPattern(1)[index % 8];
    bar.targetHeight = (0.3 + Math.abs(rhythmValue) * 0.7) * patternValue * maxHeight;
    
    // Smoothly transition to target height
    const diff = bar.targetHeight - bar.currentHeight;
    bar.currentHeight += diff * animationSpeed * speedMultiplier * deltaTime;
  });
}

// Render waveform bars
function renderWaveformBars(
  ctx: CanvasRenderingContext2D, 
  bars: WaveformBar[], 
  height: number,
  intensity: number
): void {
  ctx.clearRect(0, 0, canvasWidth, height);
  
  bars.forEach(bar => {
    const barHeight = bar.currentHeight * (intensity / 100);
    const y = height - barHeight;
    
    // Create gradient for each bar
    const gradient = ctx.createLinearGradient(bar.x, y, bar.x, height);
    gradient.addColorStop(0, bar.color);
    gradient.addColorStop(1, adjustColorBrightness(bar.color, -0.3));
    
    ctx.fillStyle = gradient;
    ctx.fillRect(bar.x, y, bar.width, barHeight);
    
    // Add glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = bar.color;
    ctx.fillRect(bar.x, y, bar.width, barHeight);
    ctx.shadowBlur = 0;
  });
}
```

---

### 3. Geometric Shapes Visualizer

#### Concept
Rotating and pulsing geometric shapes (circles, triangles, hexagons) that create an abstract, modern visual pattern.

#### Implementation Approach
- **Canvas API** for rendering
- Multiple shape layers with different rotation speeds
- Opacity and scale animations

#### Data Structure
```typescript
interface GeometricShape {
  type: 'circle' | 'triangle' | 'hexagon';
  x: number;              // Center X
  y: number;             // Center Y
  baseRadius: number;     // Base size
  currentRadius: number;  // Current size (for pulsing)
  rotation: number;       // Current rotation angle
  rotationSpeed: number;  // Rotation speed
  opacity: number;        // Current opacity
  color: string;          // Shape color
  pulsePhase: number;     // Phase for pulsing
}

interface GeometricConfig {
  shapeCount: number;        // Number of shapes
  minRadius: number;        // Minimum shape size
  maxRadius: number;        // Maximum shape size
  rotationSpeedMultiplier: number;
  pulseSpeed: number;
}
```

#### Algorithm
```typescript
// Initialize geometric shapes
function initializeGeometricShapes(
  count: number, 
  width: number, 
  height: number
): GeometricShape[] {
  const types: ('circle' | 'triangle' | 'hexagon')[] = ['circle', 'triangle', 'hexagon'];
  
  return Array.from({ length: count }, () => ({
    type: types[Math.floor(Math.random() * types.length)],
    x: Math.random() * width,
    y: Math.random() * height,
    baseRadius: minRadius + Math.random() * (maxRadius - minRadius),
    currentRadius: minRadius + Math.random() * (maxRadius - minRadius),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
    opacity: 0.2 + Math.random() * 0.3,
    color: generateColorVariant(accentColor, Math.random()),
    pulsePhase: Math.random() * Math.PI * 2
  }));
}

// Draw shape helper
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: GeometricShape
): void {
  ctx.save();
  ctx.translate(shape.x, shape.y);
  ctx.rotate(shape.rotation);
  ctx.globalAlpha = shape.opacity;
  ctx.fillStyle = shape.color;
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = 2;
  
  switch (shape.type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, shape.currentRadius, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const x = Math.cos(angle) * shape.currentRadius;
        const y = Math.sin(angle) * shape.currentRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'hexagon':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * shape.currentRadius;
        const y = Math.sin(angle) * shape.currentRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
  
  ctx.restore();
}

// Update geometric shapes
function updateGeometricShapes(
  shapes: GeometricShape[],
  deltaTime: number,
  isPlaying: boolean
): void {
  const speedMultiplier = isPlaying ? 1.0 : 0.3;
  
  shapes.forEach(shape => {
    // Update rotation
    shape.rotation += shape.rotationSpeed * speedMultiplier;
    
    // Update pulse
    shape.pulsePhase += pulseSpeed * speedMultiplier;
    if (shape.pulsePhase > Math.PI * 2) shape.pulsePhase -= Math.PI * 2;
    
    const pulseValue = Math.sin(shape.pulsePhase);
    shape.currentRadius = shape.baseRadius + pulseValue * (shape.baseRadius * 0.2);
    shape.opacity = 0.2 + Math.abs(pulseValue) * 0.3;
  });
}
```

---

### 4. Gradient Flow Visualizer

#### Concept
Flowing gradient patterns that shift and morph, creating a smooth, organic background effect.

#### Implementation Approach
- **CSS Animations** + **Canvas API** for complex gradients
- Perlin noise or similar for organic movement
- Multiple gradient layers

#### Data Structure
```typescript
interface GradientLayer {
  stops: GradientStop[];    // Color stops
  angle: number;            // Gradient angle
  centerX: number;          // Gradient center X
  centerY: number;         // Gradient center Y
  radius: number;          // Gradient radius
  animationPhase: number;  // Animation phase
}

interface GradientStop {
  color: string;
  position: number;        // Position (0-1)
}

interface GradientFlowConfig {
  layerCount: number;
  animationSpeed: number;
  colorShiftSpeed: number;
}
```

#### Algorithm
```typescript
// Initialize gradient layers
function initializeGradientLayers(
  count: number,
  accentColor: string
): GradientLayer[] {
  return Array.from({ length: count }, (_, i) => ({
    stops: [
      { color: accentColor, position: 0 },
      { color: generateColorVariant(accentColor, 0.3), position: 0.5 },
      { color: generateColorVariant(accentColor, 0.6), position: 1 }
    ],
    angle: (i / count) * Math.PI * 2,
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.5 + Math.random() * 0.5,
    animationPhase: (i / count) * Math.PI * 2
  }));
}

// Update gradient layers
function updateGradientLayers(
  layers: GradientLayer[],
  deltaTime: number,
  isPlaying: boolean,
  width: number,
  height: number
): void {
  const speedMultiplier = isPlaying ? 1.0 : 0.2;
  
  layers.forEach(layer => {
    // Animate angle
    layer.angle += 0.001 * speedMultiplier;
    if (layer.angle > Math.PI * 2) layer.angle -= Math.PI * 2;
    
    // Animate center position (circular motion)
    layer.animationPhase += 0.002 * speedMultiplier;
    layer.centerX = 0.5 + Math.cos(layer.animationPhase) * 0.1;
    layer.centerY = 0.5 + Math.sin(layer.animationPhase) * 0.1;
    
    // Animate radius
    layer.radius = 0.4 + Math.sin(layer.animationPhase * 2) * 0.2;
  });
}

// Render gradient flow
function renderGradientFlow(
  ctx: CanvasRenderingContext2D,
  layers: GradientLayer[],
  width: number,
  height: number,
  intensity: number
): void {
  ctx.clearRect(0, 0, width, height);
  
  layers.forEach((layer, index) => {
    const gradient = ctx.createRadialGradient(
      layer.centerX * width,
      layer.centerY * height,
      0,
      layer.centerX * width,
      layer.centerY * height,
      layer.radius * Math.max(width, height)
    );
    
    layer.stops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });
    
    ctx.globalAlpha = (intensity / 100) * (1 / layers.length);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}
```

---

## Color Utilities

### Color Variation Functions
```typescript
// Generate color variant from accent color
function generateColorVariant(baseColor: string, variation: number): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;
  
  // Adjust brightness
  const brightness = 0.5 + variation * 0.5;
  const r = Math.round(rgb.r * brightness);
  const g = Math.round(rgb.g * brightness);
  const b = Math.round(rgb.b * brightness);
  
  return rgbToHex(r, g, b);
}

// Adjust color brightness
function adjustColorBrightness(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const r = Math.max(0, Math.min(255, rgb.r + amount * 255));
  const g = Math.max(0, Math.min(255, rgb.g + amount * 255));
  const b = Math.max(0, Math.min(255, rgb.b + amount * 255));
  
  return rgbToHex(r, g, b);
}

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}
```

---

## Performance Optimizations

### Frame Rate Management
```typescript
class AnimationController {
  private lastFrameTime = 0;
  private targetFPS = 60;
  private frameInterval = 1000 / this.targetFPS;
  
  shouldRender(currentTime: number): boolean {
    const elapsed = currentTime - this.lastFrameTime;
    
    if (elapsed >= this.frameInterval) {
      this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
      return true;
    }
    
    return false;
  }
}
```

### Adaptive Quality
```typescript
function getAdaptiveConfig(viewportWidth: number, viewportHeight: number): VisualizerConfig {
  const isMobile = viewportWidth < 768;
  const pixelCount = viewportWidth * viewportHeight;
  
  return {
    particleCount: isMobile ? 30 : Math.min(100, Math.floor(pixelCount / 10000)),
    // ... other adaptive settings
  };
}
```

### Visibility API Integration
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause animation
      cancelAnimationFrame(animationFrameId);
    } else {
      // Resume animation
      startAnimation();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

---

## Integration Points

### usePlayerState Extension
```typescript
// Add to usePlayerState hook
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
```

### VisualEffectsMenu Integration
```typescript
// Add new section to VisualEffectsMenu
<FilterSection>
  <SectionTitle>Background Visualizer</SectionTitle>
  <ControlGroup>
    <ControlLabel>
      Enable Visualizer
      <ToggleSwitch
        checked={backgroundVisualizerEnabled}
        onChange={setBackgroundVisualizerEnabled}
      />
    </ControlLabel>
  </ControlGroup>
  
  {backgroundVisualizerEnabled && (
    <>
      <ControlGroup>
        <ControlLabel>Style</ControlLabel>
        <OptionButtonGroup>
          {visualizerStyles.map(style => (
            <OptionButton
              key={style}
              $isActive={backgroundVisualizerStyle === style}
              onClick={() => setBackgroundVisualizerStyle(style)}
            >
              {style}
            </OptionButton>
          ))}
        </OptionButtonGroup>
      </ControlGroup>
      
      <ControlGroup>
        <ControlLabel>
          Intensity: {backgroundVisualizerIntensity}%
        </ControlLabel>
        <Slider
          value={backgroundVisualizerIntensity}
          onChange={setBackgroundVisualizerIntensity}
          min={0}
          max={100}
        />
      </ControlGroup>
    </>
  )}
</FilterSection>
```

---

## Testing Strategy

### Unit Tests
- Color utility functions
- Particle physics calculations
- Waveform pattern generation
- Geometric shape rendering

### Integration Tests
- State management integration
- Visualizer enable/disable
- Style switching
- Intensity changes

### Performance Tests
- Frame rate monitoring
- Memory leak detection
- CPU usage profiling
- Mobile device testing

### Visual Regression Tests
- Screenshot comparisons for each style
- Color transition verification
- Responsive layout checks

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Technical Specification  
**Next Steps:** Begin Phase 1 implementation

