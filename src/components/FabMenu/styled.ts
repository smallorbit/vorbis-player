import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const ToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} 0;
  flex-shrink: 0;

  button {
    padding: ${theme.spacing.xs};
    border-radius: ${theme.borderRadius.md};

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
`;

export const FabMenuItem = styled.div`
  position: relative;
`;

export const FabMenuItemTooltip = styled.span`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: ${theme.colors.popover.background};
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.white};
  opacity: 0;
  transition: opacity ${theme.transitions.fast};
  pointer-events: none;

  *:hover > &,
  *:focus-within > & {
    opacity: 1;
  }

  @media (max-width: ${theme.breakpoints.lg}) {
    display: none;
  }
`;
