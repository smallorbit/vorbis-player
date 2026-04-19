import styled from 'styled-components';
import { ZEN_BAR_DURATION } from '@/constants/zenAnimation';
import { TOUCH_TARGET_MIN_PX } from '@/constants/a11y';

export const BOTTOM_BAR_HEIGHT = 60;

const ZEN_GRIP_PILL_WIDTH = '36px';
const ZEN_GRIP_PILL_HEIGHT = '4px';
const ZEN_GRIP_PILL_BOTTOM_OFFSET = '10px';

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
  transition: opacity ${ZEN_BAR_DURATION}ms ease, transform ${ZEN_BAR_DURATION}ms ease;
`;

export const BottomBarInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  height: ${BOTTOM_BAR_HEIGHT}px;
`;

export const ZenGripPill = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$visible',
})<{ $visible: boolean }>`
  width: ${ZEN_GRIP_PILL_WIDTH};
  height: ${ZEN_GRIP_PILL_HEIGHT};
  background: rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  position: absolute;
  bottom: ${ZEN_GRIP_PILL_BOTTOM_OFFSET};
  left: 50%;
  transform: translateX(-50%);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity ${ZEN_BAR_DURATION}ms ease;
  pointer-events: none;
`;

/** Hover/touch zone at the bottom of the viewport to reveal the bar */
export const ZenTriggerZone = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${TOUCH_TARGET_MIN_PX}px;
  z-index: ${({ theme }) => Number(theme.zIndex.mobileMenu) - 1};
  background: transparent;
`;

export const ZenBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => Number(theme.zIndex.mobileMenu) - 2};
  background: transparent;
`;
