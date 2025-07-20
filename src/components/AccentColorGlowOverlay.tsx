import React from 'react';
import styled from 'styled-components';

interface AccentColorGlowOverlayProps {
  glowIntensity: number;
  glowRate?: number;
  accentColor: string;
  backgroundImage?: string;
}

export const DEFAULT_GLOW_RATE = 4.5;
export const DEFAULT_GLOW_INTENSITY = 100;

const GlowBackgroundLayer = styled.div<{
  $glowIntensity: number;
  $accentColor: string;
  $glowRate: number;
}>`
  position: absolute;
  width: -webkit-fill-available;
  height: -webkit-fill-available;
  background: ${({ $accentColor }) => $accentColor};
  pointer-events: none;
  z-index: -1;
`;

export const colorDistance = (color1: [number, number, number], color2: [number, number, number]): number => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.substr(0, 2), 16),
    parseInt(cleanHex.substr(2, 2), 16),
    parseInt(cleanHex.substr(4, 2), 16)
  ];
};

const areGlowPropsEqual = (
  prevProps: AccentColorGlowOverlayProps,
  nextProps: AccentColorGlowOverlayProps
): boolean => {
  return (
    prevProps.glowIntensity === nextProps.glowIntensity &&
    prevProps.glowRate === nextProps.glowRate &&
    prevProps.accentColor === nextProps.accentColor &&
    prevProps.backgroundImage === nextProps.backgroundImage
  );
};

export const AccentColorGlowOverlay = React.memo<React.FC<AccentColorGlowOverlayProps>>(({
  glowIntensity = DEFAULT_GLOW_INTENSITY,
  glowRate = DEFAULT_GLOW_RATE,
  accentColor,
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
      $accentColor={accentColor}
      $glowRate={glowRate}
      className={glowBackgroundClasses}
    />
  );
}, areGlowPropsEqual);

AccentColorGlowOverlay.displayName = 'AccentColorGlowOverlay';

export default AccentColorGlowOverlay;