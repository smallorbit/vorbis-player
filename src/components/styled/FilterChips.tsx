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
export const Chip = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  min-height: 36px;
  border-radius: ${theme.borderRadius.flat};
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

/** Search chip expanded state — inline input within chip row. */
export const SearchChipWrapper = styled.div<{ $expanded: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  border-radius: ${theme.borderRadius.flat};
  border: 1px solid ${({ $expanded }) =>
    $expanded ? theme.colors.accent : theme.colors.control.borderHover};
  background: ${({ $expanded }) =>
    $expanded ? theme.colors.control.backgroundHover : theme.colors.control.background};
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  overflow: hidden;
  max-width: ${({ $expanded }) => ($expanded ? '220px' : '36px')};
  cursor: ${({ $expanded }) => ($expanded ? 'text' : 'pointer')};
`;

export const SearchChipIcon = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: ${theme.colors.foreground};
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;

  svg {
    width: 14px;
    height: 14px;
  }
`;

export const SearchChipInput = styled.input`
  border: none;
  background: none;
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.xs};
  outline: none;
  width: 140px;
  padding: 0 ${theme.spacing.sm} 0 0;

  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

/** Sort chip with dropdown arrow. */
export const SortChipWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

export const SortDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${theme.spacing.xs});
  left: 0;
  z-index: ${theme.zIndex.popover};
  min-width: 180px;
  background: ${theme.colors.popover.background};
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.flat};
  box-shadow: ${theme.shadows.popover};
  padding: ${theme.spacing.xs} 0;
  overflow: hidden;
`;

export const SortOption = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: none;
  background: ${({ $active }) =>
    $active ? `${theme.colors.accent}22` : 'transparent'};
  color: ${({ $active }) =>
    $active ? theme.colors.accent : theme.colors.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  text-align: left;
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
  }
`;

/** Artist list popover for "More..." chip. */
export const ArtistListPopover = styled.div`
  position: absolute;
  bottom: calc(100% + ${theme.spacing.xs});
  left: 0;
  z-index: ${theme.zIndex.popover};
  min-width: 200px;
  max-height: 280px;
  overflow-y: auto;
  background: ${theme.colors.popover.background};
  border: 1px solid ${theme.colors.popover.border};
  border-radius: ${theme.borderRadius.flat};
  box-shadow: ${theme.shadows.popover};
  padding: ${theme.spacing.xs} 0;
  scrollbar-width: thin;
`;

export const ArtistOption = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: none;
  background: ${({ $active }) =>
    $active ? `${theme.colors.accent}22` : 'transparent'};
  color: ${({ $active }) =>
    $active ? theme.colors.accent : theme.colors.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  text-align: left;
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
  }
`;

export const ArtistCount = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.muted.foreground};
  margin-left: ${theme.spacing.sm};
`;
