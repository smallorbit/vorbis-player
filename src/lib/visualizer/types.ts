// Core type definitions for the visualizer system

export interface TAnalyzerInputControl {
  connectInput(source: AudioNode): void;
  disconnectInputs(): void;
  toggleAnalyzer(value?: boolean): boolean;
  volume: number;
}

export interface FreqBinInfo {
  binLo: number;
  binHi: number;
  freqLo: number;
  freqHi: number;
  ratioLo: number;
  ratioHi: number;
  value: number;
}

export interface FreqRange {
  start: number;
  end: number;
}

export const OctaveBandModeMap = {
  1: "1/24th octave bands",
  2: "1/12th octave bands", 
  3: "1/8th octave bands",
  4: "1/6th octave bands",
  5: "1/4th octave bands",
  6: "1/3rd octave bands",
  7: "Half octave bands",
  8: "Full octave bands",
} as const;

export type OctaveBandMode = keyof typeof OctaveBandModeMap;

export const EnergyMeasureOptions = [
  "overall",
  "peak", 
  "bass",
  "lowMid",
  "mid",
  "highMid", 
  "treble",
] as const;

export type EnergyMeasure = (typeof EnergyMeasureOptions)[number];

export type ViewMode = 'playlist' | 'visualizer';