import { useState, useEffect, useCallback } from 'react';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';


export interface AlbumFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
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
  visualEffectsEnabled: boolean;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  accentColorOverrides: Record<string, string>;
  albumFilters: AlbumFilters;
  savedAlbumFilters: AlbumFilters | null;
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
  
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-visual-effects-enabled');
    return saved ? JSON.parse(saved) : true;
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

      invert: 0
    };
  });

  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
      setAccentColorOverrides(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
  }, [accentColorOverrides]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-album-filters', JSON.stringify(albumFilters));
  }, [albumFilters]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-visual-effects-enabled', JSON.stringify(visualEffectsEnabled));
  }, [visualEffectsEnabled]);
  

  
  useEffect(() => {
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(perAlbumGlow));
  }, [perAlbumGlow]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => {
      const newFilters = {
        ...prev,
        [filterName]: value
      };
      // Save the updated filters as the current settings
      setSavedAlbumFilters(newFilters);
      return newFilters;
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      invert: 0
    });
  }, []);

  const restoreSavedFilters = useCallback(() => {
    if (savedAlbumFilters) {
      setAlbumFilters(savedAlbumFilters);
    }
  }, [savedAlbumFilters]);

  return {
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    perAlbumGlow,
    accentColorOverrides,
    albumFilters,
    savedAlbumFilters,
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setAccentColor,
    setShowVisualEffects,
    setVisualEffectsEnabled,

    setPerAlbumGlow,
    setAccentColorOverrides,
    setAlbumFilters,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  };
};