import styled from 'styled-components';
import { theme } from '../styles/theme';

export const QueueDrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen', 'width', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{ isOpen: boolean; width: number; transitionDuration: number; transitionEasing: string }>`
  position: fixed;
  top: 0;
  right: 0;
  width: ${({ width }) => width}px;
  height: 100vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing},
            width ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  padding: ${theme.spacing.md};
  padding-top: calc(${theme.spacing.md} + env(safe-area-inset-top, 0px));
  box-sizing: border-box;

  container-type: inline-size;
  container-name: queue;

  @container queue (max-width: ${theme.breakpoints.md}) {
    width: ${theme.drawer.widths.mobile};
    padding: ${theme.spacing.sm};
  }

  @container queue (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.tablet};
    padding: ${theme.spacing.md};
  }

  @container queue (min-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.desktop};
    padding: ${theme.spacing.lg};
  }

  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: ${theme.drawer.widths.mobile};
    }
  }
`;

export const QueueContent = styled.div`
  padding: ${theme.spacing.sm} 0 ${theme.spacing.md} 0;

  > div:first-child {
    margin-top: 0;
  }

  > div:last-child {
    margin-bottom: 0;
  }
`;

export const QueueOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen'].includes(prop),
}) <{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
  z-index: ${theme.zIndex.overlay};
`;

export const QueueHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.md};
  padding-bottom: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.popover.border};
`;

export const QueueTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xl};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

export const SaveButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;
