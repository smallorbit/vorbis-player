import { useCallback, useEffect, startTransition } from 'react';
import type { MediaTrack } from '@/types/domain';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { theme } from '@/styles/theme';
import { extractDominantColor } from '../utils/colorExtractor';

export const useAccentColor = (
  currentTrack: MediaTrack | null,
  accentColorOverrides: Record<string, string>,
  setAccentColor: (color: string) => void,
  setAccentColorOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
) => {
  const albumId = currentTrack?.albumId;
  const albumImage = currentTrack?.image;
  const albumOverride = albumId ? accentColorOverrides[albumId] : undefined;

  useEffect(() => {
    let isCurrent = true;

    if (!albumId && !albumImage) {
      setAccentColor(theme.colors.accent);
      return () => {
        isCurrent = false;
      };
    }

    if (albumId && albumOverride) {
      setAccentColor(albumOverride);
      return () => {
        isCurrent = false;
      };
    }

    if (albumImage) {
      const extractStart = isProfilingEnabled() ? performance.now() : 0;
      extractDominantColor(albumImage)
        .then(dominantColor => {
          if (!isCurrent) return;
          if (extractStart > 0) {
            console.debug(`[Profiling] useAccentColor.extract: ${(performance.now() - extractStart).toFixed(1)}ms`);
          }
          const applyColor = () => {
            startTransition(() => {
              setAccentColor(dominantColor ? dominantColor.hex : theme.colors.accent);
            });
          };
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(applyColor, { timeout: 500 });
          } else {
            applyColor();
          }
        })
        .catch(() => {
          if (!isCurrent) return;
          setAccentColor(theme.colors.accent);
        });
    } else {
      setAccentColor(theme.colors.accent);
    }

    return () => {
      isCurrent = false;
    };
  }, [albumId, albumImage, albumOverride, setAccentColor]);

  const handleAccentColorChange = useCallback((color: string) => {
    const currentAlbumId = currentTrack?.albumId;

    if (color === 'auto') {
      if (currentAlbumId) {
        setAccentColorOverrides(prev => {
          const newOverrides = { ...prev };
          delete newOverrides[currentAlbumId];
          return newOverrides;
        });
      }

      if (currentTrack?.image) {
        extractDominantColor(currentTrack.image)
          .then(dominantColor => {
            if (dominantColor) {
              setAccentColor(dominantColor.hex);
            } else {
              setAccentColor(theme.colors.accent);
            }
          })
          .catch(() => {
            setAccentColor(theme.colors.accent);
          });
      } else {
        setAccentColor(theme.colors.accent);
      }
      return;
    }

    if (currentAlbumId) {
      setAccentColorOverrides(prev => ({ ...prev, [currentAlbumId]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  }, [currentTrack?.albumId, currentTrack?.image, setAccentColorOverrides, setAccentColor]);

  const resetToAutoColor = useCallback(() => {
    handleAccentColorChange('auto');
  }, [handleAccentColorChange]);

  return {
    handleAccentColorChange,
    resetToAutoColor,
  };
};
