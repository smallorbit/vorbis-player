# PRD: Background Visualizer Animation Feature

## Introduction/Overview

Add an optional, visually appealing background animation visualizer that renders behind the music player. The visualizer will provide a dynamic, musical aesthetic that enhances the listening experience, even without direct BPM synchronization (which Spotify's API doesn't currently support).

**Problem:** The current background is static and doesn't provide visual feedback or ambiance during music playback.

**Goal:** Create an optional, performant background visualizer that responds to playback state and track accent colors, providing a rich visual experience that complements the music.

## Goals

1. **Visual Enhancement:** Provide an engaging, musical-looking background animation
2. **Performance:** Ensure smooth 60fps animation without impacting player performance
3. **Integration:** Seamlessly integrate with existing visual effects system
4. **Customization:** Allow users to choose visualizer style and intensity
5. **Responsive:** Work well across all device sizes and orientations
6. **Optional:** Can be easily enabled/disabled by users

## User Stories

1. **As a user**, I want to enable a background visualizer to make my listening experience more immersive, so that the app feels more dynamic and engaging.

2. **As a user**, I want the visualizer to use colors from the current track's album art, so that it feels cohesive with the music I'm playing.

3. **As a user**, I want to choose from different visualizer styles, so that I can pick one that matches my mood or preference.

4. **As a user**, I want the visualizer to respond to playback state (playing/paused), so that it feels connected to the music even without BPM sync.

5. **As a user**, I want to adjust the visualizer intensity, so that it doesn't distract from the player UI when I want it subtle.

6. **As a developer**, I want the visualizer to be performant and not impact player functionality, so that users can enjoy it without performance issues.

## Functional Requirements

### FR1: Visualizer Component Architecture
- Create a new `BackgroundVisualizer` component that renders behind the player
- Position at z-index below player (e.g., z-index: 1) but above body background
- Use absolute/fixed positioning to cover full viewport
- Support multiple visualizer styles/patterns

### FR2: Visualizer Styles
Implement at least 3-4 distinct visualizer styles:
1. **Particle System**: Floating particles that drift and pulse
2. **Waveform Bars**: Vertical bars that animate with simulated rhythm
3. **Geometric Shapes**: Rotating/pulsing geometric patterns
4. **Gradient Flow**: Flowing gradient patterns that shift colors

### FR3: Color Integration
- Use current track's accent color as primary visualizer color
- Support color variations (lighter/darker shades, complementary colors)
- Fallback to theme accent color when no track is playing
- Smoothly transition colors when tracks change

### FR4: Playback State Integration
- Animate actively when music is playing
- Slow down or pause animation when music is paused
- Respond to track changes (color transitions, reset animations)
- Use playback position for subtle variation (even without BPM)

### FR5: State Management
- Add visualizer state to `usePlayerState` hook:
  - `backgroundVisualizerEnabled: boolean`
  - `backgroundVisualizerStyle: string` (style identifier)
  - `backgroundVisualizerIntensity: number` (0-100)
- Persist settings in localStorage
- Provide toggle function

### FR6: UI Controls
- Add visualizer controls to `VisualEffectsMenu`:
  - Toggle switch to enable/disable
  - Style selector (dropdown or button group)
  - Intensity slider (0-100)
- Add quick toggle button to `QuickActionsPanel` (optional)

### FR7: Performance Optimization
- Use `requestAnimationFrame` for smooth animations
- Implement frame rate limiting/throttling if needed
- Use CSS transforms and opacity for GPU acceleration
- Provide option to reduce animation complexity on low-end devices
- Pause animations when visualizer is not visible (e.g., tab hidden)

### FR8: Responsive Design
- Scale visualizer appropriately for mobile, tablet, and desktop
- Adjust particle/bar counts based on viewport size
- Ensure visualizer doesn't interfere with player controls on small screens

## Non-Goals (Out of Scope)

1. **BPM Synchronization:** Direct audio analysis or BPM sync (Spotify API limitation)
2. **Audio Visualization:** True frequency analysis or waveform generation from audio
3. **User-Generated Patterns:** Custom visualizer pattern creation by users
4. **3D Visualizations:** WebGL-based 3D visualizers (keep it 2D/Canvas for performance)
5. **Video Backgrounds:** Video-based visualizers
6. **Social Features:** Sharing visualizer screenshots or recordings

## Design Considerations

### Visual Design
- **Aesthetic:** Modern, sleek, minimal - complements the existing player design
- **Color Scheme:** Use accent colors with transparency/opacity for depth
- **Animation Style:** Smooth, organic movements rather than jarring transitions
- **Layering:** Visualizer should be subtle enough not to distract from player UI

### Technical Architecture

#### Component Structure
```
BackgroundVisualizer (container)
  ├── ParticleVisualizer
  ├── WaveformVisualizer
  ├── GeometricVisualizer
  └── GradientFlowVisualizer
```

#### State Management
- Extend `usePlayerState` with visualizer state
- Create `useBackgroundVisualizer` hook for animation logic
- Integrate with existing visual effects state system

#### Animation Approach
- **CSS Animations:** For simple, continuous animations (gradients, rotations)
- **Canvas API:** For particle systems and complex patterns
- **requestAnimationFrame:** For frame-by-frame control and performance

### Performance Strategy
1. **Lazy Loading:** Only initialize visualizer when enabled
2. **Frame Budget:** Target 60fps, but gracefully degrade if needed
3. **Visibility API:** Pause when tab is hidden
4. **Device Detection:** Reduce complexity on mobile devices
5. **Memory Management:** Clean up animations when disabled

## Technical Considerations

### Implementation Phases

#### Phase 1: Foundation (Core Infrastructure)
1. Create `BackgroundVisualizer` component structure
2. Add visualizer state to `usePlayerState`
3. Implement basic container and positioning
4. Add enable/disable toggle
5. Create `useBackgroundVisualizer` hook

#### Phase 2: First Visualizer Style (Particle System)
1. Implement particle system visualizer
2. Basic particle physics (movement, fading)
3. Color integration with accent color
4. Playback state response (speed changes)

#### Phase 3: Additional Styles
1. Waveform bars visualizer
2. Geometric shapes visualizer
3. Gradient flow visualizer

#### Phase 4: UI Integration
1. Add controls to `VisualEffectsMenu`
2. Style selector UI
3. Intensity slider
4. Quick toggle (optional)

#### Phase 5: Polish & Optimization
1. Performance tuning
2. Smooth color transitions
3. Responsive adjustments
4. Accessibility considerations

### File Structure
```
src/
├── components/
│   ├── BackgroundVisualizer.tsx          # Main container component
│   ├── visualizers/
│   │   ├── ParticleVisualizer.tsx        # Particle system style
│   │   ├── WaveformVisualizer.tsx        # Waveform bars style
│   │   ├── GeometricVisualizer.tsx       # Geometric shapes style
│   │   └── GradientFlowVisualizer.tsx    # Gradient flow style
│   └── ...
├── hooks/
│   ├── useBackgroundVisualizer.ts        # Visualizer animation logic
│   └── ...
└── utils/
    └── visualizerUtils.ts                 # Helper functions
```

### API Design

#### useBackgroundVisualizer Hook
```typescript
interface UseBackgroundVisualizerProps {
  enabled: boolean;
  style: VisualizerStyle;
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface UseBackgroundVisualizerReturn {
  canvasRef: RefObject<HTMLCanvasElement>;
  containerStyle: CSSProperties;
  // Animation control methods
}
```

#### Visualizer Style Types
```typescript
type VisualizerStyle = 
  | 'particles'
  | 'waveform'
  | 'geometric'
  | 'gradient-flow';

interface VisualizerConfig {
  particleCount: number;
  animationSpeed: number;
  colorVariation: number;
  // Style-specific config
}
```

### Integration Points

1. **usePlayerState**: Add visualizer state properties
2. **VisualEffectsMenu**: Add visualizer controls section
3. **AudioPlayer**: Pass visualizer state to BackgroundVisualizer
4. **PlayerContent**: Ensure proper z-index layering
5. **useSpotifyPlayback**: Access playback state for animation

## Success Metrics

The feature will be considered successful when:

1. ✅ **Visual Appeal:** Visualizer looks polished and musical
2. ✅ **Performance:** Maintains 60fps on mid-range devices
3. ✅ **Integration:** Seamlessly fits into existing UI/UX
4. ✅ **User Control:** Users can easily enable/disable and customize
5. ✅ **Stability:** No performance degradation or crashes
6. ✅ **Responsiveness:** Works well on mobile, tablet, and desktop

### Verification Checklist
- [ ] Visualizer renders correctly behind player
- [ ] All visualizer styles work and look good
- [ ] Color transitions are smooth
- [ ] Playback state affects animation appropriately
- [ ] Controls in VisualEffectsMenu work correctly
- [ ] Performance is acceptable (60fps target)
- [ ] No memory leaks when enabling/disabling
- [ ] Responsive on all screen sizes
- [ ] Accessibility considerations addressed
- [ ] Unit tests for visualizer logic
- [ ] Manual testing across browsers

## Open Questions

1. **Animation Library:** Should we use a library like `framer-motion` or implement custom animations?
   - **Recommendation:** Start with custom Canvas API for performance, consider library if needed

2. **Default Style:** Which visualizer style should be the default?
   - **Recommendation:** Particle system (most versatile and visually appealing)

3. **Mobile Performance:** Should visualizer be disabled by default on mobile?
   - **Recommendation:** Enable by default but with reduced complexity/particle count

4. **Intensity Levels:** How many intensity levels should be available?
   - **Recommendation:** Slider (0-100) with presets (Low: 30, Medium: 60, High: 100)

5. **Color Palette:** Should visualizer use only accent color or a palette?
   - **Recommendation:** Primary accent color with variations (lighter/darker, complementary)

6. **Animation Speed:** Should speed be tied to playback position or independent?
   - **Recommendation:** Independent but responsive to play/pause state

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Planning/Implementation  
**Estimated Complexity:** Medium-High  
**Estimated Time:** 2-3 weeks (phased approach)

