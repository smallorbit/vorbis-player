import { createPortal } from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const slideDown = keyframes`
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const TopBarContainer = styled.div<{ $reducedMotion: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483646;
  background: rgba(255, 160, 0, 0.95);
  color: #000;
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  text-align: center;
  cursor: crosshair;
  user-select: none;

  ${({ $reducedMotion }) =>
    !$reducedMotion &&
    css`
      animation: ${slideDown} 0.2s ease-out;
    `}
`;

export function DevBugTopBar() {
  const reducedMotion = useReducedMotion();

  return createPortal(
    <TopBarContainer $reducedMotion={reducedMotion}>
      Preview Mode — click an element to inspect
    </TopBarContainer>,
    document.body,
  );
}
