import { create } from 'zustand';
import type { ViewMode, FreqBinInfo } from './types';
import type FFTAnalyzer from './analyzers/fft';

export type VisualizerType = 'sphere' | 'cube' | 'grid' | 'placeholder';

interface VisualizerState {
  viewMode: ViewMode;
  isVisualizerActive: boolean;
  visualizerType: VisualizerType;
  audioContext: AudioContext | null;
  analyzerNode: AnalyserNode | null;
  fftAnalyzer: FFTAnalyzer | null;
  frequencyData: FreqBinInfo[];
  isAudioCaptureActive: boolean;
}

interface VisualizerActions {
  setViewMode: (mode: ViewMode) => void;
  setVisualizerActive: (active: boolean) => void;
  setVisualizerType: (type: VisualizerType) => void;
  setAudioContext: (context: AudioContext | null) => void;
  setAnalyzerNode: (analyzer: AnalyserNode | null) => void;
  setFFTAnalyzer: (analyzer: FFTAnalyzer | null) => void;
  setFrequencyData: (data: FreqBinInfo[]) => void;
  setAudioCaptureActive: (active: boolean) => void;
  toggleViewMode: () => void;
}

type VisualizerStore = VisualizerState & VisualizerActions;

export const useVisualizerStore = create<VisualizerStore>((set, get) => ({
  // State
  viewMode: 'playlist',
  isVisualizerActive: false,
  visualizerType: 'placeholder',
  audioContext: null,
  analyzerNode: null,
  fftAnalyzer: null,
  frequencyData: [],
  isAudioCaptureActive: false,

  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setVisualizerActive: (active) => set({ isVisualizerActive: active }),
  setVisualizerType: (type) => set({ visualizerType: type }),
  setAudioContext: (context) => set({ audioContext: context }),
  setAnalyzerNode: (analyzer) => set({ analyzerNode: analyzer }),
  setFFTAnalyzer: (analyzer) => set({ fftAnalyzer: analyzer }),
  setFrequencyData: (data) => set({ frequencyData: data }),
  setAudioCaptureActive: (active) => set({ isAudioCaptureActive: active }),
  toggleViewMode: () => {
    const { viewMode } = get();
    set({ viewMode: viewMode === 'playlist' ? 'visualizer' : 'playlist' });
  },
}));