import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const SearchBarRoot = styled.div<{ $variant: 'mobile' | 'desktop' }>`
  z-index: 6;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  ${({ $variant }) =>
    $variant === 'mobile'
      ? `border-top: 1px solid ${theme.colors.borderSubtle}; flex: 0 0 auto;`
      : `position: sticky; top: 0; border-bottom: 1px solid ${theme.colors.borderSubtle};`}
`;

export const InputWrap = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;

  & > input {
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
    border: 1px solid ${theme.colors.borderSubtle};
  }

  & > input::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

export const ClearButton = styled.button`
  appearance: none;
  background: transparent;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  position: absolute;
  right: ${theme.spacing.sm};
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.borderRadius.full};

  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.control.background};
  }
`;

export const FilterButton = styled.button<{ $hasActive?: boolean }>`
  appearance: none;
  background: transparent;
  border: 1px solid ${theme.colors.borderSubtle};
  color: ${theme.colors.white};
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${theme.colors.control.background};
  }

  &::after {
    content: '';
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${theme.colors.primary};
    display: ${({ $hasActive }) => ($hasActive ? 'block' : 'none')};
  }
`;
