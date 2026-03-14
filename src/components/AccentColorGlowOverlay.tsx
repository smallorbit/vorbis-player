import React from 'react';
import styled from 'styled-components';


export const DEFAULT_GLOW_RATE = 4.0;
export const DEFAULT_GLOW_INTENSITY = 110;

const GlowBackgroundLayer = styled.div<{
  $glowIntensity: number;
  $glowRate: number;
}>`
  position: absolute;
  width: -webkit-fill-available;
  height: -webkit-fill-available;
  background: var(--accent-color);
  pointer-events: none;
  z-index: -1;
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
  const glowBackgroundClasses = [
    glowIntensity > 0 ? 'glow-background' : 'glow-hidden'
  ].filter(Boolean).join(' ');
  return (
    <GlowBackgroundLayer
      $glowIntensity={glowIntensity}
      $glowRate={glowRate}
      className={glowBackgroundClasses}
    />
  );
}, areGlowPropsEqual);

AccentColorGlowOverlay.displayName = 'AccentColorGlowOverlay';

export default AccentColorGlowOverlay;
