import React from 'react';
import styled from 'styled-components';
import { breatheGlow } from '../styles/animations';


export const DEFAULT_GLOW_RATE = 4.0;
export const DEFAULT_GLOW_INTENSITY = 110;

const GlowBackgroundLayer = styled.div<{
  $glowIntensity: number;
  $glowRate: number;
}>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: var(--accent-color);
  pointer-events: none;
  z-index: -1;
  border-radius: inherit;
  display: block;
  transform: translateZ(0);
  will-change: transform, opacity, filter;
  opacity: calc(${({ $glowIntensity }) => $glowIntensity} / 100);
  animation: ${breatheGlow} ${({ $glowRate }) => $glowRate}s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: none;
    will-change: auto;
  }
`;

interface AccentColorGlowOverlayProps {
  glowIntensity: number;
  glowRate?: number;
  backgroundImage?: string;
}

const areGlowPropsEqual = (
  prevProps: AccentColorGlowOverlayProps,
  nextProps: AccentColorGlowOverlayProps
): boolean => {
  return (
    prevProps.glowIntensity === nextProps.glowIntensity &&
    prevProps.glowRate === nextProps.glowRate &&
    prevProps.backgroundImage === nextProps.backgroundImage
  );
};

const AccentColorGlowOverlay = React.memo<React.FC<AccentColorGlowOverlayProps>>(({
  glowIntensity = DEFAULT_GLOW_INTENSITY,
  glowRate = DEFAULT_GLOW_RATE,
  backgroundImage
}) => {
  if (glowIntensity === 0 || !backgroundImage) {
    return null;
  }
  return (
    <GlowBackgroundLayer
      $glowIntensity={glowIntensity}
      $glowRate={glowRate}
    />
  );
}, areGlowPropsEqual);

AccentColorGlowOverlay.displayName = 'AccentColorGlowOverlay';

export default AccentColorGlowOverlay;
