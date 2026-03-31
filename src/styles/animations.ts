import { keyframes } from 'styled-components';

export const breatheBorderGlow = keyframes`
  0%, 100% { --glow-opacity: 1; }
  50% { --glow-opacity: 0.2; }
`;

export const breatheGlow = keyframes`
  0%, 100% {
    filter: brightness(calc(var(--glow-intensity) / 100));
    opacity: calc(var(--glow-intensity) / 100);
    transform: translateZ(0);
  }
  50% {
    filter: brightness(0.9);
    opacity: calc(var(--glow-intensity) / 100);
    transform: translateZ(0);
  }
`;
