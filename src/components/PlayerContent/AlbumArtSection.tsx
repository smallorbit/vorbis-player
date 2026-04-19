import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { CardContent } from '@/components/styled';
import AlbumArt from '@/components/AlbumArt';
import AlbumArtQuickSwapBack from '@/components/AlbumArtQuickSwapBack';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { ProviderBadge } from '@/components/ProviderBadge';
import { useColorContext } from '@/contexts/ColorContext';
import {
  useTranslucence,
  useVisualEffectsToggle,
  useVisualizer,
} from '@/contexts/visualEffects';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useZenTouchGestures } from '@/hooks/useZenTouchGestures';
import { useTransitionWillChange } from '@/hooks/useTransitionWillChange';
import {
  ZEN_TRACK_INFO_ENTER_OPACITY_DURATION,
  ZEN_TRACK_INFO_ENTER_OPACITY_DELAY,
} from '@/constants/zenAnimation';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { VisualizerStyle } from '@/types/visualizer';
import { FlipInner, ZenTrackInfo, ZenTrackInfoInner, ZenTrackName, ZenTrackArtist } from './styled';

const ZEN_TRACK_INFO_WILL_CHANGE_FALLBACK_MS =
  ZEN_TRACK_INFO_ENTER_OPACITY_DURATION + ZEN_TRACK_INFO_ENTER_OPACITY_DELAY + 100;
import { GestureLayer } from './GestureLayer';
import { ZenClickZoneOverlay } from './ZenClickZoneOverlay';
import { ZenLikeOverlay } from './ZenLikeOverlay';

const ZenProviderBadgeInline = styled.span`
  display: inline-flex;
  vertical-align: baseline;
  margin-left: ${({ theme }) => theme.spacing.sm};
  position: relative;
  top: -1px;
`;

interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AlbumArtSectionProps {
  currentTrack: MediaTrack | null;
  currentTrackProvider?: ProviderId;
  zenModeEnabled: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
  hasPointerInput: boolean;
  isPlaying: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  onAlbumArtBoundsChange?: (bounds: AlbumArtBounds | null) => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isLiked: boolean;
  canSaveTrack: boolean;
  onLikeToggle: () => void;
  flipToggleRef?: React.MutableRefObject<(() => void) | null>;
}

export const AlbumArtSection: React.FC<AlbumArtSectionProps> = React.memo(({
  currentTrack,
  currentTrackProvider,
  zenModeEnabled,
  isMobile,
  isTablet,
  isTouchDevice,
  hasPointerInput,
  isPlaying,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onAlbumArtBoundsChange,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  isLiked,
  canSaveTrack,
  onLikeToggle,
  flipToggleRef,
}) => {
  const { connectedProviderIds } = useProviderContext();

  const {
    accentColor,
    customAccentColors,
    setAccentColor,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride,
    handleSetCustomAccentColor,
    handleRemoveCustomAccentColor,
  } = useColorContext();

  const { visualEffectsEnabled, setVisualEffectsEnabled } = useVisualEffectsToggle();
  const { translucenceEnabled, translucenceOpacity, setTranslucenceEnabled } = useTranslucence();
  const {
    backgroundVisualizerEnabled,
    setBackgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    setBackgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    setBackgroundVisualizerIntensity,
    backgroundVisualizerSpeed,
    setBackgroundVisualizerSpeed,
  } = useVisualizer();

  const {
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings,
  } = useVisualEffectsState();

  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const flipContainerRef = useRef<HTMLDivElement>(null);
  const albumArtContainerRef = useRef<HTMLDivElement | null>(null);
  const zenTrackInfoRef = useRef<HTMLDivElement>(null);
  useTransitionWillChange(
    zenTrackInfoRef,
    zenModeEnabled,
    'opacity, grid-template-rows',
    ZEN_TRACK_INFO_WILL_CHANGE_FALLBACK_MS,
  );

  const toggleFlip = useCallback(() => setIsFlipped(f => !f), []);

  useEffect(() => {
    if (flipToggleRef) flipToggleRef.current = toggleFlip;
    return () => { if (flipToggleRef) flipToggleRef.current = null; };
  }, [flipToggleRef, toggleFlip]);

  const zenTouchActive = isTouchDevice && zenModeEnabled && !isFlipped;

  const zenTouchGestures = useZenTouchGestures({
    enabled: zenTouchActive,
    isPlaying,
    onPlay,
    onPause,
    onLikeToggle,
    onFlipToggle: toggleFlip,
  });

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleClick = useCallback((_e: React.MouseEvent) => {
    if (zenTouchActive || (zenModeEnabled && isFlipped)) {
      return;
    }
    toggleFlip();
  }, [zenTouchActive, zenModeEnabled, isFlipped, toggleFlip]);

  const handleRetryAlbumArt = useCallback(async () => {
    const providerId = currentTrackProvider ?? currentTrack?.provider;
    if (!providerId) return;
    const { providerRegistry } = await import('@/providers/registry');
    const descriptor = providerRegistry.get(providerId);
    descriptor?.playback.refreshCurrentTrackArt?.();
  }, [currentTrackProvider, currentTrack?.provider]);

  useEffect(() => {
    if (!onAlbumArtBoundsChange) return;
    const el = albumArtContainerRef.current;
    if (!el) {
      onAlbumArtBoundsChange(null);
      return;
    }
    const report = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        onAlbumArtBoundsChange({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        onAlbumArtBoundsChange(null);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onAlbumArtBoundsChange(null);
    };
  }, [onAlbumArtBoundsChange]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentTrack?.id]);

  const handleMouseEnter = useCallback(() => {
    if (zenModeEnabled && hasPointerInput) setIsHovered(true);
  }, [zenModeEnabled, hasPointerInput]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  useEffect(() => {
    if (!zenModeEnabled) {
      setIsHovered(false);
    }
  }, [zenModeEnabled]);


  useEffect(() => {
    if (!isFlipped) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest?.('[data-eyedropper-overlay]')) return;
      const insideAlbumArt = flipContainerRef.current?.contains(target);
      if (!insideAlbumArt) {
        setIsFlipped(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFlipped]);

  const handleCustomAccentColor = useCallback((color: string) => {
    if (currentTrack?.albumId) {
      if (color === '') {
        handleRemoveAccentColorOverride(currentTrack.albumId);
        handleRemoveCustomAccentColor(currentTrack.albumId);
      } else {
        handleSetAccentColorOverride(currentTrack.albumId, color);
        handleSetCustomAccentColor(currentTrack.albumId, color);
        setAccentColor(color);
      }
    }
  }, [currentTrack?.albumId, handleSetAccentColorOverride, handleRemoveAccentColorOverride, handleSetCustomAccentColor, handleRemoveCustomAccentColor, setAccentColor]);

  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrack?.albumId) {
      handleResetAccentColorOverride(currentTrack.albumId);
      return;
    }
    if (currentTrack?.albumId) {
      handleSetAccentColorOverride(currentTrack.albumId, color);
    }
    setAccentColor(color);
  }, [currentTrack?.albumId, handleSetAccentColorOverride, handleResetAccentColorOverride, setAccentColor]);

  const handleGlowToggle = useCallback(() => {
    if (visualEffectsEnabled) {
      setVisualEffectsEnabled(false);
    } else {
      setVisualEffectsEnabled(true);
      restoreGlowSettings();
    }
  }, [visualEffectsEnabled, setVisualEffectsEnabled, restoreGlowSettings]);

  const handleBackgroundVisualizerToggle = useCallback(() => {
    setBackgroundVisualizerEnabled(prev => !prev);
  }, [setBackgroundVisualizerEnabled]);

  const handleBackgroundVisualizerStyleChange = useCallback((style: VisualizerStyle) => {
    setBackgroundVisualizerStyle(style);
  }, [setBackgroundVisualizerStyle]);

  const handleTranslucenceToggle = useCallback(() => {
    setTranslucenceEnabled(prev => !prev);
  }, [setTranslucenceEnabled]);

  const handleBackgroundVisualizerIntensityChange = useCallback((intensity: number) => {
    setBackgroundVisualizerIntensity(Math.max(0, Math.min(100, intensity)));
  }, [setBackgroundVisualizerIntensity]);

  const handleBackgroundVisualizerSpeedChange = useCallback((speed: number) => {
    setBackgroundVisualizerSpeed(speed);
  }, [setBackgroundVisualizerSpeed]);

  return (
    <>
      <CardContent style={{
        position: 'relative',
        zIndex: 2,
        minHeight: 0,
        alignItems: 'center',
        transform: zenModeEnabled ? 'translateY(0)' : `translateY(${isMobile ? '0.25rem' : '0.5rem'})`
      }}>
        <div ref={flipContainerRef} style={{ width: '100%', position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <GestureLayer
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            onSwipeUp={onSwipeUp}
            onSwipeDown={onSwipeDown}
            isTouchDevice={isTouchDevice}
            onClick={handleClick}
            onLongPress={toggleFlip}
            zenTouchHandlers={zenTouchActive ? zenTouchGestures : undefined}
            albumArtContainerRef={albumArtContainerRef}
            zenModeEnabled={zenModeEnabled}
            hasPointerInput={hasPointerInput}
          >
            <FlipInner $isFlipped={isFlipped}>
              <ProfiledComponent id="AlbumArt">
                <AlbumArt
                  currentTrack={currentTrack}
                  accentColor={accentColor}
                  glowIntensity={visualEffectsEnabled ? effectiveGlow.intensity : 0}
                  glowRate={effectiveGlow.rate}
                  glowEnabled={visualEffectsEnabled}
                  translucenceEnabled={translucenceEnabled}
                  translucenceOpacity={translucenceOpacity}
                  zenMode={zenModeEnabled}
                  onRetryAlbumArt={handleRetryAlbumArt}
                />
              </ProfiledComponent>
              <AlbumArtQuickSwapBack
                currentTrack={currentTrack}
                accentColor={accentColor}
                onAccentColorChange={handleAccentColorChange}
                customAccentColorOverrides={customAccentColors}
                onCustomAccentColor={handleCustomAccentColor}
                glowEnabled={visualEffectsEnabled}
                onGlowToggle={handleGlowToggle}
                glowIntensity={effectiveGlow.intensity}
                onGlowIntensityChange={handleGlowIntensityChange}
                glowRate={effectiveGlow.rate}
                onGlowRateChange={handleGlowRateChange}
                backgroundVisualizerEnabled={backgroundVisualizerEnabled}
                onBackgroundVisualizerToggle={handleBackgroundVisualizerToggle}
                backgroundVisualizerStyle={backgroundVisualizerStyle}
                onBackgroundVisualizerStyleChange={handleBackgroundVisualizerStyleChange}
                backgroundVisualizerIntensity={backgroundVisualizerIntensity}
                onBackgroundVisualizerIntensityChange={handleBackgroundVisualizerIntensityChange}
                backgroundVisualizerSpeed={backgroundVisualizerSpeed}
                onBackgroundVisualizerSpeedChange={handleBackgroundVisualizerSpeedChange}
                translucenceEnabled={translucenceEnabled}
                onTranslucenceToggle={handleTranslucenceToggle}
                isMobile={isMobile}
                isTablet={isTablet}
                onClose={() => setIsFlipped(false)}
                onRetryAlbumArt={handleRetryAlbumArt}
              />
            </FlipInner>
          </GestureLayer>
          <ZenClickZoneOverlay
            isPlaying={isPlaying}
            visible={zenModeEnabled && hasPointerInput && !zenTouchActive && !isFlipped}
            onPrevious={onPrevious}
            onNext={onNext}
            onPlayPause={handlePlayPause}
          />
          <ZenLikeOverlay
            isLiked={isLiked}
            isVisible={zenModeEnabled && hasPointerInput && isHovered && !isFlipped}
            canSaveTrack={canSaveTrack}
            onToggleLike={onLikeToggle}
            zenModeEnabled={zenModeEnabled}
          />
        </div>
      </CardContent>
      <ZenTrackInfo $zenMode={zenModeEnabled} ref={zenTrackInfoRef}>
        <ZenTrackInfoInner>
          <ZenTrackName $isMobile={isMobile} $isTablet={isTablet}>
            {currentTrack?.name}
            {zenModeEnabled && connectedProviderIds.length > 1 && currentTrackProvider != null && (
              <ZenProviderBadgeInline>
                <ProviderBadge providerId={currentTrackProvider} iconOnly />
              </ZenProviderBadgeInline>
            )}
          </ZenTrackName>
          {currentTrack?.artists && (
            <ZenTrackArtist>{currentTrack.artists}</ZenTrackArtist>
          )}
        </ZenTrackInfoInner>
      </ZenTrackInfo>
    </>
  );
});

AlbumArtSection.displayName = 'AlbumArtSection';
