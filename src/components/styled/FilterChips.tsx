import styled from 'styled-components';
import { theme } from '@/styles/theme';

/** Horizontally scrollable chip row with hidden scrollbar. */
export const ChipRow = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  overflow-x: auto;
  padding: ${theme.spacing.xs} 0;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    display: none;
  }
`;

/** Individual filter chip — pill-style toggle button. */
export const Chip = styled.button<{ $active?: boolean | undefined }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  min-height: 36px;
  border-radius: ${theme.borderRadius.full};
  border: 1px solid ${({ $active }) =>
    $active ? theme.colors.accent : theme.colors.control.borderHover};
  background: ${({ $active }) =>
    $active ? `${theme.colors.accent}22` : theme.colors.control.background};
  color: ${({ $active }) =>
    $active ? theme.colors.accent : theme.colors.foreground};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all ${theme.transitions.fast} ease;
  touch-action: manipulation;

  &:hover {
    background: ${({ $active }) =>
      $active ? `${theme.colors.accent}33` : theme.colors.control.backgroundHover};
  }

  &:active {
    transform: scale(0.96);
  }

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
`;
