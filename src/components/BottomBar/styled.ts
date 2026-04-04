import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const BOTTOM_BAR_HEIGHT = 60;

export const BottomBarContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenHidden', '$autoHidden'].includes(prop),
})<{ $zenHidden?: boolean; $autoHidden?: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndex.mobileMenu};
  background: ${({ theme }) => theme.colors.overlay.bar};
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid ${({ theme }) => theme.colors.popover.border};
  padding-bottom: env(safe-area-inset-bottom, 0px);
  opacity: ${({ $zenHidden, $autoHidden }) => ($zenHidden || $autoHidden) ? 0 : 1};
  transform: ${({ $zenHidden, $autoHidden }) => ($zenHidden || $autoHidden) ? 'translateY(100%)' : 'translateY(0)'};
  pointer-events: ${({ $zenHidden, $autoHidden }) => ($zenHidden || $autoHidden) ? 'none' : 'auto'};
  /* When revealing: longer fade-in with short delay so it's not jarring. When hiding: quick. */
  transition: ${({ $zenHidden, $autoHidden, theme }) =>
    ($zenHidden || $autoHidden)
      ? `opacity ${theme.transitions.slow} ease, transform ${theme.transitions.slow} ease`
      : `opacity 0.5s ease-out 0.15s, transform 0.5s ease-out 0.15s`};
`;

export const BottomBarInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${theme.spacing.md};
  height: ${BOTTOM_BAR_HEIGHT}px;
`;

/** Invisible hover/touch zone at the bottom of the viewport to reveal the bar in zen mode */
export const ZenTriggerZone = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  z-index: ${Number(theme.zIndex.mobileMenu) - 1};
  background: transparent;
`;
