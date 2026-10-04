import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const SaveQueueButton = styled.button`
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

