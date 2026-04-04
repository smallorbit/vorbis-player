import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const BOTTOM_BAR_HEIGHT = 60;

export const BottomBarContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$hidden',
})<{ $hidden?: boolean }>`
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
  opacity: ${({ $hidden }) => $hidden ? 0 : 1};
  transform: ${({ $hidden }) => $hidden ? 'translateY(100%)' : 'translateY(0)'};
  pointer-events: ${({ $hidden }) => $hidden ? 'none' : 'auto'};
  transition: opacity 0.3s ease, transform 0.3s ease;
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
