import { useState, useEffect, useCallback } from 'react';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';
import { DEFAULT_GLOW_RATE } from '../components/AccentColorGlowOverlay';

export interface AlbumFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
  grayscale: number;
  invert: number;
}

export interface PlayerState {
  tracks: Track[];
  currentTrackIndex: number;
  isLoading: boolean;
  error: string | null;
  selectedPlaylistId: string | null;
  showPlaylist: boolean;
  accentColor: string;
  showVisualEffects: boolean;
  glowIntensity: number;
  glowRate: number;
  glowMode: 'global' | 'per-album';
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  accentColorOverrides: Record<string, string>;
  albumFilters: AlbumFilters;
}

export const usePlayerState = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [showVisualEffects, setShowVisualEffects] = useState(false);
  
  const [glowIntensity, setGlowIntensity] = useState<number>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-intensity');
    return saved ? parseInt(saved, 10) : 100;
  });
  
  const [glowRate, setGlowRate] = useState<number>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-rate');
    return saved ? parseFloat(saved) : DEFAULT_GLOW_RATE;
  });
  
  const [glowMode, setGlowMode] = useState<'global' | 'per-album'>(() => {
    const saved = localStorage.getItem('vorbis-player-glow-mode');
    return saved === 'per-album' ? 'per-album' : 'global';
  });
  
  const [perAlbumGlow, setPerAlbumGlow] = useState<Record<string, { intensity: number; rate: number }>>(() => {
    const saved = localStorage.getItem('vorbis-player-per-album-glow');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [accentColorOverrides, setAccentColorOverrides] = useState<Record<string, string>>({});
  
  const [albumFilters, setAlbumFilters] = useState<AlbumFilters>(() => {
    const saved = localStorage.getItem('vorbis-player-album-filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          brightness: parsed.brightness ?? 100,
          contrast: parsed.contrast ?? 100,
          saturation: parsed.saturation ?? 100,
          hue: parsed.hue ?? 0,
          blur: parsed.blur ?? 0,
          sepia: parsed.sepia ?? 0,
          grayscale: parsed.grayscale ?? 0,
          invert: typeof parsed.invert === 'boolean' ? (parsed.invert ? 1 : 0) : parsed.invert
        };
      } catch (e) {
        return {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          hue: 0,
          blur: 0,
          sepia: 0,
          grayscale: 0,
          invert: 0
        };
      }
    }
    return {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: 0
    };
  });

  // Load overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
      setAccentColorOverrides(JSON.parse(stored));
    }
  }, []);

  // Save overrides to localStorage when changed
  useEffect(() => {
    localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
  }, [accentColorOverrides]);

  // Persist album filters to localStorage
  useEffect(() => {
    localStorage.setItem('vorbis-player-album-filters', JSON.stringify(albumFilters));
  }, [albumFilters]);

  // Persist glow settings to localStorage
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-intensity', glowIntensity.toString());
  }, [glowIntensity]);
  
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-rate', glowRate.toString());
  }, [glowRate]);
  
  useEffect(() => {
    localStorage.setItem('vorbis-player-glow-mode', glowMode);
  }, [glowMode]);
  
  useEffect(() => {
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(perAlbumGlow));
  }, [perAlbumGlow]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: 0
    });
  }, []);

  return {
    // State
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    accentColor,
    showVisualEffects,
    glowIntensity,
    glowRate,
    glowMode,
    perAlbumGlow,
    accentColorOverrides,
    albumFilters,
    
    // Setters
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setAccentColor,
    setShowVisualEffects,
    setGlowIntensity,
    setGlowRate,
    setGlowMode,
    setPerAlbumGlow,
    setAccentColorOverrides,
    setAlbumFilters,
    
    // Handlers
    handleFilterChange,
    handleResetFilters,
  };
};