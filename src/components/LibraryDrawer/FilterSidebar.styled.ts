import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  padding: ${theme.spacing.lg};
  background: rgba(20, 20, 20, 0.3);
  flex-shrink: 0;

  /* Desktop: persistent left sidebar */
  @media (min-width: ${theme.breakpoints.lg}) {
    border-right: 1px solid ${theme.colors.popover.border};
    min-width: 160px;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export const FilterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

export const SectionTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  color: ${theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const SearchInputWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.md};
  padding: 0 ${theme.spacing.sm};
  transition: all ${theme.transitions.fast};

  &:focus-within {
    border-color: ${theme.colors.control.borderHover};
    background: ${theme.colors.control.backgroundHover};
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.9),
      0 0 0 4px rgba(255, 255, 255, 0.85),
      0 0 12px 0 rgba(255, 255, 255, 0.35);
  }
`;

export const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: ${theme.colors.muted.foreground};
  flex-shrink: 0;

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

export const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: ${theme.spacing.sm} 0;
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.white};
  min-width: 0;

  &:focus-visible {
    box-shadow: none;
  }

  &::placeholder {
    color: ${theme.colors.muted.foreground};
  }
`;

export const ClearSearchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${theme.colors.muted.foreground};
  transition: color ${theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    color: ${theme.colors.white};
  }

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

export const ToggleGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  flex-direction: column;
`;

export const ToggleButton = styled.button<{ $active: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${({ $active }) =>
    $active ? theme.colors.control.backgroundHover : theme.colors.control.background};
  border: 1px solid
    ${({ $active }) =>
      $active ? theme.colors.control.borderHover : theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  color: ${({ $active }) =>
    $active ? theme.colors.white : theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  text-align: left;
  font-weight: ${({ $active }) => ($active ? theme.fontWeight.semibold : theme.fontWeight.normal)};

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    color: ${theme.colors.white};
  }

  &:active {
    opacity: 0.8;
  }
`;

export const ChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.spacing.sm};
`;

export const FilterChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  border-radius: 999px;
  border: 1px solid
    ${({ $active }) =>
      $active ? theme.colors.control.borderHover : theme.colors.control.border};
  background: ${({ $active }) =>
    $active ? theme.colors.control.backgroundHover : 'transparent'};
  color: ${({ $active }) => ($active ? theme.colors.white : theme.colors.muted.foreground)};
  font-size: ${theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? theme.fontWeight.semibold : theme.fontWeight.normal)};
  cursor: pointer;
  transition: all ${theme.transitions.fast};

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    border-color: ${theme.colors.control.borderHover};
    color: ${theme.colors.white};
  }

  &:active {
    opacity: 0.8;
  }
`;

export const SortSelect = styled.select`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  appearance: none;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    border-color: ${theme.colors.control.borderHover};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.control.borderHover};
  }

  option {
    background: ${theme.colors.popover.background};
    color: ${theme.colors.white};
  }
`;

export const RecentlyPlayedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

export const RecentlyPlayedItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  text-align: left;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    border-color: ${theme.colors.control.borderHover};
    color: ${theme.colors.white};
  }

  &:active {
    opacity: 0.8;
  }
`;

export const RecentlyPlayedThumbnail = styled.div`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: ${theme.borderRadius.sm};
  overflow: hidden;
  background: ${theme.colors.control.borderHover};
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  svg {
    width: 14px;
    height: 14px;
    color: ${theme.colors.muted.foreground};
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

export const RecentlyPlayedLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ClearFiltersButton = styled.button`
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  background: ${theme.colors.control.background};
  border: 1px solid ${theme.colors.control.border};
  border-radius: ${theme.borderRadius.flat};
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  margin-top: auto;

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    color: ${theme.colors.white};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
