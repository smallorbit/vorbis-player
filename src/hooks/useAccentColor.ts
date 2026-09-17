import { useCallback, useEffect, startTransition } from 'react';
import type { MediaTrack } from '@/types/domain';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { theme } from '@/styles/theme';
import { useNewestWins, type NewestWinsToken } from '@/hooks/useNewestWins';
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

  // Newest-wins guard shared by the track-change effect and the user-invoked
  // "auto" re-extraction. Both do async color extraction; the latest request
  // wins, so a superseded extraction (a previous track, or an effect the
  // user's auto pick replaced) cannot commit its stale color. Unmount
  // invalidates every outstanding token.
  const accentGuard = useNewestWins();
  useEffect(() => () => { accentGuard.invalidate(); }, [accentGuard]);

  const commitAccentColor = useCallback((token: NewestWinsToken, colorValue: string) => {
    if (token.isStale()) return;
    setAccentColor(colorValue);
  }, [setAccentColor]);

  useEffect(() => {
    const token = accentGuard.begin();

    if (!albumId && !albumImage) {
      commitAccentColor(token, theme.colors.accent);
      return;
    }

    if (albumId && albumOverride) {
      commitAccentColor(token, albumOverride);
      return;
    }

    if (albumImage) {
      const extractStart = isProfilingEnabled() ? performance.now() : 0;
      extractDominantColor(albumImage)
        .then(dominantColor => {
          if (token.isStale()) return;
          if (extractStart > 0) {
            console.debug(`[Profiling] useAccentColor.extract: ${(performance.now() - extractStart).toFixed(1)}ms`);
          }
          const applyColor = () => {
            startTransition(() => {
              commitAccentColor(token, dominantColor ? dominantColor.hex : theme.colors.accent);
            });
          };
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(applyColor, { timeout: 500 });
          } else {
            applyColor();
          }
        })
        .catch(() => {
          commitAccentColor(token, theme.colors.accent);
        });
    } else {
      commitAccentColor(token, theme.colors.accent);
    }
  }, [accentGuard, albumId, albumImage, albumOverride, commitAccentColor]);

  const handleAccentColorChange = useCallback((color: string) => {
    const currentAlbumId = currentTrack?.albumId;

    // Every path here is a fresh user intent — claim the newest token so a
    // still-in-flight extraction from the track-change effect cannot overwrite
    // it, and (for the auto path) so a later track change supersedes this.
    const token = accentGuard.begin();

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
            commitAccentColor(token, dominantColor ? dominantColor.hex : theme.colors.accent);
          })
          .catch(() => {
            commitAccentColor(token, theme.colors.accent);
          });
      } else {
        commitAccentColor(token, theme.colors.accent);
      }
      return;
    }

    if (currentAlbumId) {
      setAccentColorOverrides(prev => ({ ...prev, [currentAlbumId]: color }));
    }
    commitAccentColor(token, color);
  }, [accentGuard, currentTrack?.albumId, currentTrack?.image, setAccentColorOverrides, commitAccentColor]);

  const resetToAutoColor = useCallback(() => {
    handleAccentColorChange('auto');
  }, [handleAccentColorChange]);

  return {
    handleAccentColorChange,
    resetToAutoColor,
  };
};
