import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const FilterBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  padding-top: ${theme.spacing.md};
`;

export const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

export const GroupLabel = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  cursor: pointer;
  color: ${theme.colors.foreground};
  font-size: ${theme.fontSize.sm};
  text-transform: capitalize;
`;

export const SortSelect = styled.select`
  appearance: none;
  background: ${theme.colors.control.background};
  color: ${theme.colors.white};
  border: 1px solid ${theme.colors.borderSubtle};
  border-radius: ${theme.borderRadius.md};
  padding: ${theme.spacing.sm};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
`;

export const ClearAllButton = styled.button`
  appearance: none;
  background: transparent;
  border: 1px solid ${theme.colors.borderSubtle};
  color: ${theme.colors.foreground};
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  font-size: ${theme.fontSize.sm};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: ${theme.colors.control.background};
  }
`;
