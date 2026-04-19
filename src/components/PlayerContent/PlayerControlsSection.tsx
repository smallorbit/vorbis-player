import React, { Suspense, lazy, useState, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'styled-components';
import { CardContent } from '@/components/styled';
import SpotifyPlayerControls from '@/components/SpotifyPlayerControls';
import BottomBar from '@/components/BottomBar';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useProfilingContext } from '@/contexts/ProfilingContext';
import type { VisualizerStyle } from '@/types/visualizer';
import { useVisualizerDebug } from '@/contexts/VisualizerDebugContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useVolume } from '@/hooks/useVolume';
import { useTrackListContext } from '@/contexts/TrackContext';
import { BottomBarActionsProvider, type BottomBarActionsValue } from '@/contexts/BottomBarActionsContext';
import { clearCacheWithOptions } from '@/services/cache/libraryCache';
import { clearAllPins } from '@/services/settings/pinnedItemsStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ClearCacheOptions } from '@/components/VisualEffectsMenu';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useTransitionWillChange } from '@/hooks/useTransitionWillChange';
import {
  ZEN_CONTROLS_OPACITY_EXIT_DURATION,
  ZEN_CONTROLS_OPACITY_EXIT_DELAY,
} from '@/constants/zenAnimation';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { RadioState } from '@/types/radio';
import { LoadingCard, ZenControlsWrapper, ZenControlsInner } from './styled';

const ZEN_CONTROLS_WILL_CHANGE_FALLBACK_MS =
  ZEN_CONTROLS_OPACITY_EXIT_DURATION + ZEN_CONTROLS_OPACITY_EXIT_DELAY + 100;

const VisualEffectsMenu = lazy(() => import('@/components/VisualEffectsMenu/index'));
const KeyboardShortcutsHelp = lazy(() => import('@/components/KeyboardShortcutsHelp'));

function ControlsLoadingFallback(): React.ReactElement {
  const theme = useTheme();
  return (
    <div style={{
      height: '80px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.muted.foreground
    }}>
      Loading controls...
    </div>
  );
}

function VisualEffectsLoadingFallback(): React.ReactElement {
  const theme = useTheme();
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '350px',
      height: '100vh',
      background: theme.colors.overlay.panel,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.muted.foreground,
      fontSize: theme.fontSize.sm
    }}>
      Loading effects...
    </div>
  );
}

interface PlayerControlsSectionProps {
  currentTrack: MediaTrack | null;
  currentTrackProvider?: ProviderId;
  isPlaying: boolean;
  zenModeEnabled: boolean;
  hasPointerInput: boolean;
  showLibrary: boolean;
  showQueue: boolean;
  controlsRef: React.RefObject<HTMLDivElement>;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onArtistBrowse: (artistName: string) => void;
  onAlbumPlay: (albumId: string, albumName: string) => void;
  onShowQueue: () => void;
  onCloseQueue: () => void;
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onOpenQuickAccessPanel?: () => void;
  onZenModeToggle: () => void;
  isRadioAvailable?: boolean;
  onStartRadio?: () => void;
  radioState?: RadioState;
  isLiked: boolean;
  isLikePending: boolean;
  onLikeToggle: () => void;
}

export const PlayerControlsSection: React.FC<PlayerControlsSectionProps> = React.memo(({
  currentTrack,
  currentTrackProvider,
  isPlaying,
  zenModeEnabled,
  hasPointerInput,
  showLibrary,
  showQueue,
  controlsRef,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onArtistBrowse,
  onAlbumPlay,
  onShowQueue,
  onCloseQueue,
  onOpenLibrary,
  onCloseLibrary,
  onOpenQuickAccessPanel,
  onZenModeToggle,
  isRadioAvailable,
  onStartRadio,
  radioState,
  isLiked,
  isLikePending,
  onLikeToggle,
}) => {
  const { tracks, handleShuffleToggle } = useTrackListContext();
  const { isMobile } = usePlayerSizingContext();
  const { accentColor } = useColorContext();
  const { effectiveGlow, restoreGlowSettings } = useVisualEffectsState();
  const { handleMuteToggle, volume, setVolumeLevel } = useVolume(currentTrackProvider);

  const {
    visualEffectsEnabled,
    setVisualEffectsEnabled,
    backgroundVisualizerStyle,
    setBackgroundVisualizerStyle,
    setTranslucenceEnabled,
    showVisualEffects,
    setShowVisualEffects,
  } = useVisualEffectsContext();

  const { enabled: profilerEnabled, toggle: profilerToggle } = useProfilingContext();
  const vizDebugCtx = useVisualizerDebug();
  const visualizerDebugEnabled = vizDebugCtx?.isDebugMode ?? false;
  const [qapEnabled, setQapEnabled] = useQapEnabled();

  const settingsHasBeenOpenedRef = useRef(false);
  if (showVisualEffects) settingsHasBeenOpenedRef.current = true;

  const zenControlsWrapperRef = useRef<HTMLDivElement>(null);
  useTransitionWillChange(
    zenControlsWrapperRef,
    zenModeEnabled,
    'grid-template-rows, opacity, transform',
    ZEN_CONTROLS_WILL_CHANGE_FALLBACK_MS,
  );

  const [showHelp, setShowHelp] = useState(false);
  const toggleHelp = useCallback(() => setShowHelp(prev => !prev), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);

  const handleShowVisualEffects = useCallback(() => {
    onCloseQueue();
    onCloseLibrary();
    setShowVisualEffects(true);
  }, [onCloseQueue, onCloseLibrary, setShowVisualEffects]);

  const handleCloseVisualEffects = useCallback(() => setShowVisualEffects(false), [setShowVisualEffects]);

  const handleToggleVisualEffectsMenu = useCallback(() => {
    onCloseQueue();
    onCloseLibrary();
    setShowVisualEffects(prev => !prev);
  }, [setShowVisualEffects, onCloseQueue, onCloseLibrary]);

  const handleGlowToggle = useCallback(() => {
    if (visualEffectsEnabled) {
      setVisualEffectsEnabled(false);
    } else {
      setVisualEffectsEnabled(true);
      restoreGlowSettings();
    }
  }, [visualEffectsEnabled, setVisualEffectsEnabled, restoreGlowSettings]);

  const VISUALIZER_CYCLE: VisualizerStyle[] = ['fireflies', 'comet', 'wave', 'grid'];

  const handleCycleVisualizerStyle = useCallback(() => {
    const currentIndex = VISUALIZER_CYCLE.indexOf(backgroundVisualizerStyle);
    const nextIndex = (currentIndex + 1) % VISUALIZER_CYCLE.length;
    setBackgroundVisualizerStyle(VISUALIZER_CYCLE[nextIndex]);
  }, [backgroundVisualizerStyle, setBackgroundVisualizerStyle]);

  const handleTranslucenceToggle = useCallback(() => {
    setTranslucenceEnabled(prev => !prev);
  }, [setTranslucenceEnabled]);

  const handleClearCache = useCallback(async (options: ClearCacheOptions) => {
    await clearCacheWithOptions({ clearLikes: options.clearLikes });
    if (options.clearPins) {
      await clearAllPins();
    }
    if (options.clearAccentColors) {
      localStorage.removeItem(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_ACCENT_COLORS);
    }
    if (options.clearPins || options.clearAccentColors) {
      const { clearPreferencesSyncTimestamp, getPreferencesSync } =
        await import('@/providers/dropbox/dropboxPreferencesSync');
      clearPreferencesSyncTimestamp();
      getPreferencesSync()?.initialSync();
    }
  }, []);

  const handleProfilerToggle = useCallback(() => {
    if (!profilerEnabled) {
      vizDebugCtx?.setIsDebugMode(false);
    }
    profilerToggle();
  }, [profilerEnabled, profilerToggle, vizDebugCtx]);

  const handleVisualizerDebugToggle = useCallback(() => {
    if (!visualizerDebugEnabled && profilerEnabled) {
      profilerToggle();
    }
    vizDebugCtx?.setIsDebugMode(prev => !prev);
  }, [visualizerDebugEnabled, profilerEnabled, profilerToggle, vizDebugCtx]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [onPlay, onPause, isPlaying]);

  const handleEscapeClose = useCallback(() => {
    onCloseLibrary();
    handleCloseVisualEffects();
    if (showHelp) closeHelp();
  }, [onCloseLibrary, handleCloseVisualEffects, showHelp, closeHelp]);

  const handleArrowUp = useCallback(() => {
    if (showLibrary) {
      onCloseLibrary();
      onShowQueue();
    } else if (showQueue) {
      onCloseQueue();
    } else {
      onShowQueue();
    }
  }, [showLibrary, showQueue, onShowQueue, onCloseQueue, onCloseLibrary]);

  const handleArrowDown = useCallback(() => {
    const openPanel = qapEnabled ? onOpenQuickAccessPanel : onOpenLibrary;
    if (showQueue) {
      onCloseQueue();
      openPanel?.();
    } else if (showLibrary) {
      onCloseLibrary();
    } else {
      openPanel?.();
    }
  }, [showQueue, showLibrary, onCloseQueue, onOpenQuickAccessPanel, onOpenLibrary, onCloseLibrary, qapEnabled]);

  const handleVolumeUp = useCallback(() => {
    setVolumeLevel(Math.min(100, (volume ?? 50) + 5));
  }, [volume, setVolumeLevel]);

  const handleVolumeDown = useCallback(() => {
    setVolumeLevel(Math.max(0, (volume ?? 50) - 5));
  }, [volume, setVolumeLevel]);

  const bottomBarActions = useMemo<BottomBarActionsValue>(() => ({
    hidden: showLibrary && isMobile,
    showSettings: handleShowVisualEffects,
    showQueue: onShowQueue,
    openLibrary: onOpenLibrary,
    toggleZenMode: onZenModeToggle,
    startRadio: isRadioAvailable ? onStartRadio : undefined,
    openQuickAccessPanel: onOpenQuickAccessPanel,
    radioGenerating: radioState?.isGenerating,
  }), [
    showLibrary,
    isMobile,
    handleShowVisualEffects,
    onShowQueue,
    onOpenLibrary,
    onZenModeToggle,
    isRadioAvailable,
    onStartRadio,
    onOpenQuickAccessPanel,
    radioState?.isGenerating,
  ]);

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: onNext,
    onPrevious: onPrevious,
    onCloseQueue: onCloseQueue,
    onToggleVisualEffectsMenu: handleToggleVisualEffectsMenu,
    onCloseVisualEffects: handleEscapeClose,
    onCycleVisualizerStyle: handleCycleVisualizerStyle,
    onToggleGlow: handleGlowToggle,
    onToggleTranslucence: handleTranslucenceToggle,
    onMute: handleMuteToggle,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    onToggleLike: onLikeToggle,
    onToggleShuffle: handleShuffleToggle,
    onToggleHelp: toggleHelp,
    onShowQueue: handleArrowUp,
    onOpenLibrary: onOpenLibrary,
    onOpenQuickAccessPanel: handleArrowDown,
    onToggleZenMode: onZenModeToggle,
  }, { prefersPointerInput: hasPointerInput });

  return (
    <>
      <ZenControlsWrapper $zenMode={zenModeEnabled} ref={zenControlsWrapperRef}>
        <ZenControlsInner ref={controlsRef}>
          <LoadingCard
            backgroundImage={currentTrack?.image}
            accentColor={accentColor}
            glowEnabled={visualEffectsEnabled}
            glowIntensity={effectiveGlow.intensity}
            glowRate={effectiveGlow.rate}
          >
            <CardContent style={{
              position: 'relative',
              zIndex: 2,
              flex: '0 0 auto',
              minHeight: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Suspense fallback={<ControlsLoadingFallback />}>
                <ProfiledComponent id="SpotifyPlayerControls">
                  <SpotifyPlayerControls
                    currentTrack={currentTrack}
                    trackCount={tracks.length}
                    isLiked={isLiked}
                    isLikePending={isLikePending}
                    onToggleLike={onLikeToggle}
                    onPlay={onPlay}
                    onPause={onPause}
                    onNext={onNext}
                    onPrevious={onPrevious}
                    onArtistBrowse={onArtistBrowse}
                    onAlbumPlay={onAlbumPlay}
                    onPlayRadio={isRadioAvailable ? onStartRadio : undefined}
                    currentTrackProvider={currentTrackProvider}
                  />
                </ProfiledComponent>
              </Suspense>
            </CardContent>
          </LoadingCard>
        </ZenControlsInner>
      </ZenControlsWrapper>
      <ProfiledComponent id="BottomBar">
        <BottomBarActionsProvider value={bottomBarActions}>
          <BottomBar />
        </BottomBarActionsProvider>
      </ProfiledComponent>
      {settingsHasBeenOpenedRef.current && (
        <Suspense fallback={<VisualEffectsLoadingFallback />}>
          <VisualEffectsMenu
            isOpen={showVisualEffects}
            onClose={handleCloseVisualEffects}
            onClearCache={handleClearCache}
            profilerEnabled={profilerEnabled}
            onProfilerToggle={handleProfilerToggle}
            visualizerDebugEnabled={visualizerDebugEnabled}
            onVisualizerDebugToggle={handleVisualizerDebugToggle}
            qapEnabled={qapEnabled}
            onQapToggle={() => setQapEnabled(!qapEnabled)}
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <KeyboardShortcutsHelp isOpen={showHelp} onClose={closeHelp} />
      </Suspense>
    </>
  );
});

PlayerControlsSection.displayName = 'PlayerControlsSection';
