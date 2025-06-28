# Audio Visualizer System

This system provides real-time audio analysis for Spotify music playback using the Web Audio API and FFT analysis.

## Architecture

### Core Components

1. **FFTAnalyzer** (`analyzers/fft.ts`) - Performs real-time frequency analysis
2. **SpotifyAudioBridge** (`../../components/visualizer/SpotifyAudioBridge.tsx`) - Connects Spotify audio to the analyzer
3. **Visualizer State** (`state.ts`) - Zustand store for managing visualizer state
4. **Type Definitions** (`types.ts`) - TypeScript interfaces and types

### Data Flow

```
Spotify Player → Browser Audio → MediaStream → FFT Analyzer → Frequency Data → Zustand Store → Visualizers
```

## Usage

### Basic Setup

1. Import the required components and hooks:

```tsx
import { SpotifyAudioBridge } from '../../components/visualizer/SpotifyAudioBridge';
import { useVisualizerStore } from '../lib/visualizer/state';
```

2. Add the bridge component to your app:

```tsx
function App() {
  const { setVisualizerActive } = useVisualizerStore();

  return (
    <div>
      {/* Your app content */}
      <SpotifyAudioBridge onAnalyzerReady={(analyzer) => console.log('Ready:', analyzer)} />
    </div>
  );
}
```

3. Activate the visualizer:

```tsx
function VisualizerControls() {
  const { isVisualizerActive, setVisualizerActive } = useVisualizerStore();

  return (
    <button onClick={() => setVisualizerActive(!isVisualizerActive)}>
      {isVisualizerActive ? 'Stop' : 'Start'} Visualizer
    </button>
  );
}
```

### Accessing Audio Data

Use the Zustand store to access real-time frequency data:

```tsx
function AudioVisualizer() {
  const { frequencyData, isVisualizerActive } = useVisualizerStore();

  if (!isVisualizerActive || frequencyData.length === 0) {
    return <div>No audio data</div>;
  }

  return (
    <div className="flex items-end h-32">
      {frequencyData.map((bin, index) => (
        <div
          key={index}
          className="bg-blue-500 min-w-[2px]"
          style={{ height: `${bin.value * 100}%` }}
          title={`${bin.freqLo}-${bin.freqHi}Hz: ${bin.value.toFixed(3)}`}
        />
      ))}
    </div>
  );
}
```

### Advanced FFT Analyzer Usage

```tsx
function AdvancedVisualizer() {
  const { fftAnalyzer } = useVisualizerStore();

  useEffect(() => {
    if (!fftAnalyzer) return;

    // Get energy in specific frequency ranges
    const bassEnergy = fftAnalyzer.getEnergy('bass');
    const midEnergy = fftAnalyzer.getEnergy('mid'); 
    const trebleEnergy = fftAnalyzer.getEnergy('treble');

    console.log({ bassEnergy, midEnergy, trebleEnergy });
  }, [fftAnalyzer]);

  return <div>Advanced visualizer content</div>;
}
```

## Audio Capture Methods

The system supports multiple audio capture methods with automatic fallback:

1. **Screen Capture with Audio** (Primary) - Captures system audio including Spotify
2. **Microphone Input** (Fallback) - Uses microphone for visualization

### User Permissions

Users will be prompted to grant permissions for:
- Screen capture with audio (for Spotify integration)
- Microphone access (fallback option)

## Configuration

### FFT Analyzer Settings

```tsx
// Available through fftAnalyzer instance
fftAnalyzer.mode = 2; // Octave band mode (1-8)
fftAnalyzer.volume = 0.8; // Output volume (0-1)
```

### Frequency Ranges

The analyzer provides pre-defined frequency ranges:
- **bass**: 20-250 Hz
- **lowMid**: 250-500 Hz  
- **mid**: 500-2000 Hz
- **highMid**: 2000-4000 Hz
- **treble**: 4000-16000 Hz

## State Management

The Zustand store provides:

```tsx
interface VisualizerStore {
  // State
  viewMode: 'playlist' | 'visualizer';
  isVisualizerActive: boolean;
  audioContext: AudioContext | null;
  analyzerNode: AnalyserNode | null;
  fftAnalyzer: FFTAnalyzer | null;
  frequencyData: FreqBinInfo[];
  isAudioCaptureActive: boolean;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setVisualizerActive: (active: boolean) => void;
  toggleViewMode: () => void;
  // ... other actions
}
```

## Troubleshooting

### Common Issues

1. **No audio data**: Ensure user has granted screen capture or microphone permissions
2. **Spotify not detected**: The bridge captures system audio, not direct Spotify streams
3. **Performance issues**: Reduce FFT size or limit visualization update frequency

### Browser Compatibility

- Chrome/Edge: Full support for screen capture with audio
- Firefox: Limited support, may fall back to microphone
- Safari: Microphone only

## Example Implementation

See `VisualizerDemo.tsx` for a complete working example with:
- Basic controls
- Real-time frequency visualization
- Audio metrics calculation
- Error handling and fallbacks