import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const BOTTOM_BAR_HEIGHT = 60;

export const BottomBarContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenHidden'].includes(prop),
})<{ $zenHidden?: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: ${theme.zIndex.mobileMenu};
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  opacity: ${({ $zenHidden }) => $zenHidden ? 0 : 1};
  transform: ${({ $zenHidden }) => $zenHidden ? 'translateY(100%)' : 'translateY(0)'};
  pointer-events: ${({ $zenHidden }) => $zenHidden ? 'none' : 'auto'};
  transition: opacity 350ms ease, transform 350ms ease;
`;

export const BottomBarInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  height: ${BOTTOM_BAR_HEIGHT}px;
`;

export const BottomBarDivider = styled.div`
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
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
