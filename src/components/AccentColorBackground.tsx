import React from 'react';
import styled from 'styled-components';
import { generateColorVariant } from '../utils/visualizerUtils';

interface AccentColorBackgroundProps {
  enabled: boolean;
  accentColor: string;
}

const BackgroundGradient = styled.div<{ $accentColor: string }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    135deg,
    ${({ $accentColor }) => $accentColor}20 0%,
    ${({ $accentColor }) => generateColorVariant($accentColor, 0.3)}15 50%,
    ${({ $accentColor }) => generateColorVariant($accentColor, 0.6)}10 100%
  );
  transition: background 0.5s ease;
`;

/**
 * AccentColorBackground Component
 * 
 * Renders a subtle gradient background using the current track's accent color.
 * Provides a cohesive visual experience that matches the music player's theme.
 * 
 * @component
 */
export const AccentColorBackground: React.FC<AccentColorBackgroundProps> = ({
  enabled,
  accentColor
}) => {
  if (!enabled) {
    return null;
  }

  return <BackgroundGradient $accentColor={accentColor} />;
};

export default AccentColorBackground;

