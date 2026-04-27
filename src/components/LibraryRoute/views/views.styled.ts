import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const HomeStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xl};
  padding-top: ${theme.spacing.lg};
  padding-bottom: ${theme.spacing.xl};
  width: 100%;
  min-height: 0;
`;

export const SeeAllRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  width: 100%;
  padding-bottom: ${theme.spacing.xl};
`;

export const BackBar = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
`;

export const BackButton = styled.button`
  appearance: none;
  background: transparent;
  border: none;
  color: ${theme.colors.white};
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${theme.borderRadius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  & > svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  &:hover {
    background: ${theme.colors.control.background};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const BackTitle = styled.h1`
  margin: 0;
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;
