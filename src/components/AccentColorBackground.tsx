import React from 'react';
import styled from 'styled-components';
import { generateColorVariant } from '../utils/visualizerUtils';

interface AccentColorBackgroundProps {
  enabled: boolean;
  accentColor: string;
}

const BackgroundGradient = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  transition: background 0.5s ease;
`;

const AccentColorBackground: React.FC<AccentColorBackgroundProps> = ({
  enabled,
  accentColor
}) => {
  if (!enabled) {
    return null;
  }

  const background = `linear-gradient(135deg, ${accentColor}20 0%, ${generateColorVariant(accentColor, 0.3)}15 50%, ${generateColorVariant(accentColor, 0.6)}10 100%)`;

  return <BackgroundGradient style={{ background }} />;
};

export default AccentColorBackground;
