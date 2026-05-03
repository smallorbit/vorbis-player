import styled from 'styled-components';

export const DrawerOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.overlay.light};
  z-index: ${({ theme }) => theme.zIndex.overlay};
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: opacity ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing},
            visibility ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing};
`;

export const DrawerContainer = styled.div<{ $isOpen: boolean; $width: number; $transitionDuration: number; $transitionEasing: string }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${({ $width }) => $width}px;
  max-width: 95vw;
  background: ${({ theme }) => theme.colors.overlay.dark};
  backdrop-filter: blur(${({ theme }) => theme.drawer.backdropBlur});
  border-left: 1px solid ${({ theme }) => theme.colors.popover.border};
  transform: translateX(${({ $isOpen }) => ($isOpen ? '0' : '100%')});
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  transition: transform ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing},
            visibility ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing},
            width ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${({ theme }) => theme.zIndex.modal};
  overflow-y: auto;
  overflow-x: hidden;

  /* Enable container queries */
  container-type: inline-size;
  container-name: visual-effects;

  /* Container query responsive adjustments */
  @container visual-effects (max-width: ${({ theme }) => theme.drawer.breakpoints.mobile}) {
    width: ${({ theme }) => theme.drawer.widths.mobile};
  }

  @container visual-effects (min-width: ${({ theme }) => theme.drawer.breakpoints.mobile}) and (max-width: ${({ theme }) => theme.drawer.breakpoints.tablet}) {
    width: ${({ theme }) => theme.drawer.widths.tablet};
  }

  @container visual-effects (min-width: ${({ theme }) => theme.drawer.breakpoints.tablet}) {
    width: ${({ theme }) => theme.drawer.widths.desktop};
  }

  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
      width: ${({ theme }) => theme.drawer.widths.mobile};
    }
  }
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(${({ theme }) => theme.spacing.lg} + env(safe-area-inset-top, 0px)) ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.popover.border};
  min-height: 60px;
  flex-shrink: 0; /* Prevent header from shrinking */
`;

export const DrawerTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.foreground};
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.fast} ease;

  &:hover {
    color: ${({ theme }) => theme.colors.white};
    background: ${({ theme }) => theme.colors.muted.background};
  }

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

export const DrawerContent = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const ControlLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
`;

export const FilterSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.popover.border};
  padding-top: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const SectionTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;


export const FilterGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const ResetButton = styled.button`
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.muted.foreground};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.lg};

  &:hover {
    background: hsl(var(--muted));
    border-color: hsl(var(--ring));
    color: ${({ theme }) => theme.colors.foreground};
    transform: translateY(-1px);
  }
`;

export const OptionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

export const ProviderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
`;

export const ProviderName = styled.span`
  font-size: 0.8125rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
`;

export const ProviderStatusBadge = styled.span<{ $status: 'connected' | 'disabled' }>`
  font-size: 0.6875rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  color: ${({ $status, theme }) =>
    $status === 'connected' ? theme.colors.success : theme.colors.muted.foreground};
  flex: 1;
`;


export const CacheOptionsList = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const CacheOptionItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const CacheCheckbox = styled.input`
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.control.background};
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:checked {
    background: hsl(var(--primary));
    border-color: hsl(var(--primary));
  }

  &:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: 2px solid #fff;
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }
`;

export const CacheOptionLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
  cursor: pointer;
  user-select: none;
`;

export const CacheConfirmButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const CacheCancelButton = styled.button`
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.muted.foreground};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};
  flex: 1;
  margin-top: ${({ theme }) => theme.spacing.lg};

  &:hover {
    background: ${({ theme }) => theme.colors.muted.background};
    color: ${({ theme }) => theme.colors.foreground};
    transform: translateY(-1px);
  }
`;

export const OptionButton = styled.button<{ $isActive: boolean }>`
  background: ${({ $isActive, theme }) => $isActive ? 'hsl(var(--primary))' : theme.colors.muted.background};
  border: 1px solid ${({ $isActive, theme }) => $isActive ? 'hsl(var(--primary))' : theme.colors.border};
  color: ${({ $isActive, theme }) => $isActive ? 'hsl(var(--primary-foreground))' : theme.colors.muted.foreground};
  padding: 0.375rem 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  min-width: 60px;

  &:hover {
    background: ${({ $isActive }) => $isActive ? 'hsl(var(--primary) / 0.87)' : 'hsl(var(--muted))'};
    border-color: hsl(var(--ring));
    color: ${({ $isActive, theme }) => $isActive ? 'hsl(var(--primary-foreground))' : theme.colors.white};
    transform: translateY(-1px);
  }
`;
