import React from 'react';
import styled, { keyframes, css } from 'styled-components';

interface AccentColorGlowOverlayProps {
  glowIntensity: number;
  glowRate?: number;
  accentColor: string;
  backgroundImage?: string;
}

// Breathing animation that mimics music tempo
const breatheAnimation = keyframes`
  0%, 100% {
    
    filter: brightness(0.9);
    // filter: saturate(0.8);
    // opacity: 1;
  }
  50% {
    filter: brightness(1.25);
    // filter: saturate(1.1);
    // opacity: 0.8;
  }
`;

export const DEFAULT_GLOW_RATE = 2.5;

// Background glow layer - pure accent color
const GlowBackgroundLayer = styled.div<{
  $glowIntensity: number;
  $accentColor: string;
  $glowRate: number;
}>`
  position: absolute;
  width: -webkit-fill-available;
  height: -webkit-fill-available;
  
  // border: 5px solid red;
  background: ${({ $accentColor }) => $accentColor};
  pointer-events: none;
  z-index: -1;
  
  ${({ $glowIntensity, $glowRate }) => $glowIntensity > 0 && css`
    animation: ${breatheAnimation} ${$glowRate || DEFAULT_GLOW_RATE}s ease-in-out infinite;
  `}
  
  opacity: ${({ $glowIntensity }) => $glowIntensity / 100};
  display: ${({ $glowIntensity }) => $glowIntensity > 0 ? 'block' : 'none'};
`;



// Helper function to check if two colors are similar
export const colorDistance = (color1: [number, number, number], color2: [number, number, number]): number => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
};

// Convert hex color to RGB array
export const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.substr(0, 2), 16),
    parseInt(cleanHex.substr(2, 2), 16),
    parseInt(cleanHex.substr(4, 2), 16)
  ];
};

export const AccentColorGlowOverlay: React.FC<AccentColorGlowOverlayProps> = ({
  glowIntensity,
  glowRate = DEFAULT_GLOW_RATE,
  accentColor,
  backgroundImage
}) => {
 
  if (glowIntensity === 0 || !backgroundImage) {
    return null;
  }

  return (
    
      
      <GlowBackgroundLayer
        $glowIntensity={glowIntensity}
        $accentColor={accentColor}
        $glowRate={glowRate}
      />
      
    
  );
};

export default AccentColorGlowOverlay;