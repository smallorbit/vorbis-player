import styled from 'styled-components';
import { cardBase } from '@/styles/utils';
import { BOTTOM_BAR_HEIGHT } from '@/components/BottomBar/styled';
import {
  ZEN_ART_DURATION,
  ZEN_ART_EASING,
  ZEN_ART_ENTER_DELAY,
  ZEN_CONTROLS_DURATION,
  ZEN_CONTROLS_EXIT_DELAY,
  ZEN_CONTROLS_OPACITY_EXIT_DURATION,
  ZEN_CONTROLS_OPACITY_EXIT_DELAY,
  ZEN_CONTROLS_TRANSFORM_EXIT_DELAY,
  ZEN_TRACK_INFO_ENTER_OPACITY_DURATION,
  ZEN_TRACK_INFO_ENTER_OPACITY_DELAY,
  ZEN_TRACK_INFO_ENTER_HEIGHT_DURATION,
  ZEN_TRACK_INFO_ENTER_HEIGHT_DELAY,
  ZEN_TRACK_INFO_EXIT_DURATION,
  ZEN_ART_MARGIN_H,
  ZEN_ART_MARGIN_V,
  ZEN_ART_MARGIN_H_MOBILE,
  ZEN_ART_MARGIN_V_MOBILE,
} from '@/constants/zenAnimation';

export const ContentWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => !['width', 'padding', 'useFluidSizing', 'transitionDuration', 'transitionEasing', '$zenMode'].includes(prop),
}) <{
  width: number;
  padding: number;
  useFluidSizing: boolean;
  transitionDuration: number;
  transitionEasing: string;
  $zenMode?: boolean;
}>`
  width: ${props => props.$zenMode ? '100%' : props.useFluidSizing ? '100%' : `${props.width}px`};
  max-width: ${props => props.$zenMode ? '100%' : `${props.width}px`};

  margin: 0 auto;
  padding: ${props => props.padding}px;
  padding-bottom: ${props => props.padding}px;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  overflow: visible;

  transition: width ${props => props.$zenMode ? `${ZEN_ART_DURATION}ms ${ZEN_ART_EASING} ${ZEN_ART_ENTER_DELAY}ms` : `${ZEN_ART_DURATION}ms ${ZEN_ART_EASING}`},
            padding ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            padding-bottom ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING},
            max-width ${props => props.$zenMode ? `${ZEN_ART_DURATION}ms ${ZEN_ART_EASING} ${ZEN_ART_ENTER_DELAY}ms` : `${ZEN_ART_DURATION}ms ${ZEN_ART_EASING}`};

  container-type: inline-size;
  container-name: player;
  display: flex;
  flex-direction: column;
  /* Prevent overflow on tablets; content must fit above bottom bar + safe area */
  max-height: ${props => props.$zenMode ? 'none' : `calc(100dvh - ${BOTTOM_BAR_HEIGHT}px)`};
`;

export const PlayerContainer = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export const PlayerStack = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenMode'].includes(prop),
})<{ $zenMode?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0; /* Allow flex shrink so content fits above bottom bar */
  max-width: ${({ $zenMode }) => $zenMode
    ? `min(calc(100vw - ${ZEN_ART_MARGIN_H}px), calc(100dvh - ${ZEN_ART_MARGIN_V}px))`
    : `min(calc(100vw - 48px), calc(100dvh - var(--player-controls-height, 220px) - ${120 + BOTTOM_BAR_HEIGHT}px))`
  };
  margin: 0 auto;
  /* Entering zen: art grows after controls fade out (300ms delay). Exiting zen: art shrinks immediately. */
  transition: ${({ $zenMode }) => $zenMode
    ? `max-width ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING} ${ZEN_ART_ENTER_DELAY}ms`
    : `max-width ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING}`
  };

  @media (max-width: ${({ theme }) => theme.breakpoints.lg}) {
    ${({ $zenMode }) => $zenMode && `
      max-width: min(calc(100vw - ${ZEN_ART_MARGIN_H_MOBILE}px), calc(100dvh - ${ZEN_ART_MARGIN_V_MOBILE}px));
    `}
  }
`;

export const ZenControlsWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenMode'].includes(prop),
})<{ $zenMode: boolean }>`
  display: grid;
  grid-template-rows: ${({ $zenMode }) => $zenMode ? '0fr' : '1fr'};
  opacity: ${({ $zenMode }) => $zenMode ? 0 : 1};
  transform: ${({ $zenMode }) => $zenMode ? 'scale(0.95) translateY(-8px)' : 'scale(1) translateY(0)'};
  transform-origin: top center;
  /*
   * grid-template-rows animates over the actual element height (unlike max-height which
   * animates over an arbitrary 500px range, causing non-linear perceived speed).
   * Entering zen: controls collapse + fade in 300ms, then art expands (300ms delay).
   * Exiting zen: art shrinks first (1000ms), then controls expand + fade in (350ms).
   * --player-controls-height is pre-set synchronously via stableControlsHeightRef before
   * the state flip, so PlayerStack has the correct target from the first animation frame.
   */
  transition: ${({ $zenMode }) => $zenMode
    ? `grid-template-rows ${ZEN_CONTROLS_DURATION}ms ease, opacity ${ZEN_CONTROLS_DURATION}ms ease, transform ${ZEN_CONTROLS_DURATION}ms ease`
    : `grid-template-rows ${ZEN_CONTROLS_EXIT_DELAY}ms ease ${ZEN_CONTROLS_EXIT_DELAY}ms, opacity ${ZEN_CONTROLS_OPACITY_EXIT_DURATION}ms ease ${ZEN_CONTROLS_OPACITY_EXIT_DELAY}ms, transform ${ZEN_CONTROLS_DURATION}ms ease ${ZEN_CONTROLS_TRANSFORM_EXIT_DELAY}ms`
  };
  pointer-events: ${({ $zenMode }) => $zenMode ? 'none' : 'auto'};
`;

export const ZenControlsInner = styled.div`
  min-height: 0;
  overflow: hidden;
`;

export const ZenTrackInfo = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenMode'].includes(prop),
})<{ $zenMode: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  pointer-events: none;
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.md};
  overflow: hidden;
  opacity: ${({ $zenMode }) => $zenMode ? 1 : 0};
  max-height: ${({ $zenMode }) => $zenMode ? '5rem' : '0'};
  transition: ${({ $zenMode }) => $zenMode
    ? `opacity ${ZEN_TRACK_INFO_ENTER_OPACITY_DURATION}ms ease ${ZEN_TRACK_INFO_ENTER_OPACITY_DELAY}ms, max-height ${ZEN_TRACK_INFO_ENTER_HEIGHT_DURATION}ms ease ${ZEN_TRACK_INFO_ENTER_HEIGHT_DELAY}ms`
    : `opacity ${ZEN_TRACK_INFO_EXIT_DURATION}ms ease, max-height ${ZEN_TRACK_INFO_EXIT_DURATION}ms ease`
  };
`;

export const ZenTrackName = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$isMobile', '$isTablet'].includes(prop),
})<{ $isMobile: boolean; $isTablet: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.fontSize.lg;
    if ($isTablet) return theme.fontSize.xl;
    return theme.fontSize['2xl'];
  }};
  color: ${({ theme }) => theme.colors.white};
  text-shadow: ${({ theme }) => theme.shadows.textMd};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
`;

export const ZenTrackArtist = styled.div`
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.gray[300]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
`;

export const ClickableAlbumArtContainer = styled.div<{ $swipeEnabled?: boolean; $bothGestures?: boolean }>`
  position: relative;
  cursor: pointer;
  z-index: 3;
  perspective: 1200px;
  filter: drop-shadow(${({ theme }) => theme.shadows.drop});
  ${({ $swipeEnabled, $bothGestures }) => $swipeEnabled && `
    touch-action: ${$bothGestures ? 'none' : 'pan-y'};
    user-select: none;
    -webkit-user-select: none;
  `}
`;

export const FlipInner = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$isFlipped'].includes(prop),
})<{ $isFlipped: boolean }>`
  width: 100%;
  aspect-ratio: 1;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform: ${({ $isFlipped }) => $isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'};
`;

export const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop: string) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
  ${cardBase};
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  margin-left: 0.25rem;
  margin-right: 0.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  box-shadow: ${({ theme }) => theme.shadows.card};
  transition: box-shadow ${({ theme }) => theme.transitions.normal}, border-color ${({ theme }) => theme.transitions.normal};
  ${({ theme, backgroundImage }) => backgroundImage ? `
    &::after {
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    &::before {
      position: absolute;
      inset: 0;
      background: ${theme.colors.card.overlay};
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: linear-gradient(
      to bottom,
      ${theme.colors.card.gradientTop} 0%,
      ${theme.colors.card.gradientBottom} 100%
    );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
  `}
`;
