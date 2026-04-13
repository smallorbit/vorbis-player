import styled from 'styled-components';
import { theme } from '@/styles/theme';

const spinnerKeyframes = `
  @keyframes vorbis-spinner-spin {
    to { transform: rotate(360deg); }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('vorbis-spinner-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vorbis-spinner-keyframes';
  style.textContent = spinnerKeyframes;
  document.head.appendChild(style);
}

export const TabSpinner = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: #1db954;
  border-radius: 50%;
  animation: vorbis-spinner-spin 0.8s linear infinite;
  margin-left: 0.4rem;
  vertical-align: middle;
`;

export const TabsContainer = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid ${({ theme }) => theme.colors.popover.border};
`;

export const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: none;
  border: none;
  color: ${({ theme, $active }) => ($active ? theme.colors.spotify : theme.colors.muted.foreground)};
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.spotify : 'transparent')};
  margin-bottom: -2px;
  position: relative;

  &:hover {
    color: ${({ theme, $active }) => ($active ? theme.colors.spotify : theme.colors.foreground)};
  }

  &:focus {
    outline: none;
  }
`;

export const ControlsContainer = styled.div<{ $inDrawer?: boolean }>`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex-direction: column;
    align-items: stretch;
    flex-wrap: nowrap;
  `
      : ''}
`;

export const SortControlsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  min-width: 0;
`;

export const SelectDropdown = styled.select`
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  outline: none;
  transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  option {
    background: ${({ theme }) => theme.colors.popover.background};
    color: ${({ theme }) => theme.colors.white};
  }
`;

export const RefreshButton = styled.button<{ $spinning: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.foreground};
  cursor: pointer;
  border-radius: 50%;
  transition: background ${({ theme }) => theme.transitions.fast} ease;
  padding: 0;
  flex-shrink: 0;

  &:active {
    background: ${({ theme }) => theme.colors.control.background};
  }

  & > svg {
    animation: ${({ $spinning }) => ($spinning ? 'vorbis-spinner-spin 0.8s linear infinite' : 'none')};
  }
`;

export const DrawerRefreshButton = styled(RefreshButton)`
  flex-shrink: 0;
`;

export const DrawerBottomControls = styled.div`
  flex-shrink: 0;
  padding: ${theme.spacing.sm} 0 0;

  /* Remove bottom margin from ControlsContainer when at bottom of drawer */
  & > div {
    margin-bottom: 0;
  }
`;

export const DrawerBottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  min-width: 0;
  flex-wrap: wrap;
`;

export const DrawerBottomActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  flex-shrink: 0;
  margin-left: auto;
`;

export const ClearButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    color: ${({ theme }) => theme.colors.white};
  }
`;

export const DrawerClearFiltersButton = styled(ClearButton)`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  font-size: ${({ theme }) => theme.fontSize.xs};
`;
