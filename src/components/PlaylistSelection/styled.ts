import styled from 'styled-components';
import { Card } from '../styled';
import { theme } from '@/styles/theme';

const spinnerKeyframes = `
  @keyframes vorbis-spinner-spin {
    to { transform: rotate(360deg); }
  }
`;

// Inject the keyframes once
if (typeof document !== 'undefined' && !document.getElementById('vorbis-spinner-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vorbis-spinner-keyframes';
  style.textContent = spinnerKeyframes;
  document.head.appendChild(style);
}

export const Container = styled.div<{ $inDrawer?: boolean }>`
  width: 100%;
  display: flex;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 0 ${theme.spacing.lg} ${theme.spacing.md};
    box-sizing: border-box;
  `
      : `
    min-height: 100vh;
    min-height: 100dvh;
    align-items: center;
    justify-content: center;
    padding: 1rem;

    @media (max-width: ${theme.breakpoints.lg}) {
      padding: 0.5rem;
    }
  `}
`;

export const SelectionCard = styled(Card)<{ $maxWidth: number; $inDrawer?: boolean }>`
  width: 100%;
  max-width: ${({ $maxWidth, $inDrawer }) => ($inDrawer ? 'none' : `${$maxWidth}px`)};
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: none;
    background-color: transparent;
    backdrop-filter: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 0;
    margin: 0;
  `
      : `
    background: ${theme.colors.muted.background};
    backdrop-filter: blur(12px);
    border: 1px solid ${theme.colors.control.border};
    border-radius: 1.25rem;
    box-shadow: ${theme.shadows.albumArt};
    display: flex;
    flex-direction: column;
    max-height: min(90dvh, 900px);
  `}
`;

export const DrawerContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 ${theme.spacing.md};
  overflow: hidden;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
`;

export const PlaylistGridDiv = styled.div<{ $inDrawer?: boolean }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $inDrawer }) => ($inDrawer ? '160px' : '280px')}, 1fr));
  gap: ${({ $inDrawer }) => ($inDrawer ? '0.75rem' : '1rem')};
  padding: 1rem 0;
  overflow-y: auto;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  `
      : `
    flex: 1;
    min-height: 0;
  `}
`;

export const MobileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 0.75rem;
  padding: 0.25rem 0 1rem;
  overflow-y: auto;
  flex: 1 1 0px;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  align-content: start;
`;

const GridCard = styled.div`
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: transform 0.15s ease, background 0.15s ease;
  min-width: 0;

  &:active {
    transform: scale(0.97);
    background: rgba(255, 255, 255, 0.04);
  }
`;

export const GridCardArtWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  overflow: hidden;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.gray[800]}, ${({ theme }) => theme.colors.gray[700]});

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

export const GridCardTextArea = styled.div`
  padding: 0.5rem 0.125rem 0;
`;

export const GridCardTitle = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
`;

export const GridCardSubtitle = styled.div<{ $clickable?: boolean }>`
  font-size: 0.6875rem;
  color: ${({ theme }) => theme.colors.muted.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
  margin-top: 1px;
  ${({ theme, $clickable }) => $clickable && `
    cursor: pointer;
    transition: color ${theme.transitions.fast} ease;

    &:hover {
      color: ${theme.colors.accent};
      text-decoration: underline;
    }

    &:active {
      color: ${theme.colors.selection};
    }
  `}
`;

const PlaylistItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast} ease;

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-2px);
  }
`;

export const PlaylistImageWrapper = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: linear-gradient(45deg, ${({ theme }) => theme.colors.gray[700]}, ${({ theme }) => theme.colors.gray[600]});
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const PlaylistInfoDiv = styled.div`
  flex: 1;
  min-width: 0;
`;

export const PlaylistName = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
`;

export const PlaylistDetails = styled.div`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
`;

export const ClickableArtist = styled.span`
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: ${theme.colors.accent};
    text-decoration: underline;
  }

  &:active {
    color: rgba(218, 165, 32, 0.8);
  }
`;

export const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
`;

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

export const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: ${({ theme }) => theme.spacing.sm} ${theme.spacing.lg};
  background: ${({ theme }) => theme.colors.control.background};
  border: 1px solid ${({ theme }) => theme.colors.control.borderHover};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  outline: none;
  transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &::placeholder {
    color: ${({ theme }) => theme.colors.muted.foreground};
  }

  &:focus {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    border-color: ${({ theme }) => theme.colors.accent};
  }
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

export const EmptyState = styled.div<{ $fullWidth?: boolean }>`
  ${({ $fullWidth }) => $fullWidth && 'grid-column: 1 / -1;'}
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.muted.foreground};
`;

export const PinButton = styled.button<{ $isPinned: boolean; $disabled?: boolean }>`
  background: none;
  border: none;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  padding: ${({ theme }) => theme.spacing.xs};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ $isPinned, $disabled }) => ($isPinned ? 1 : $disabled ? 0.3 : 0)};
  color: ${({ theme, $isPinned }) => ($isPinned ? theme.colors.spotify : theme.colors.muted.foreground)};
  transition: all ${({ theme }) => theme.transitions.fast} ease;
  flex-shrink: 0;

  @media (hover: none) {
    opacity: ${({ $isPinned, $disabled }) => ($isPinned ? 1 : $disabled ? 0.3 : 0.5)};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const PinnableListItem = styled(PlaylistItem)`
  &:hover ${PinButton} {
    opacity: 1;
  }
`;

export const GridCardPinOverlay = styled.div<{ $isPinned: boolean }>`
  position: absolute;
  top: ${({ theme }) => theme.spacing.sm};
  right: ${({ theme }) => theme.spacing.sm};
  z-index: 2;
  background: ${({ theme }) => theme.colors.overlay.bar};
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ $isPinned }) => ($isPinned ? 1 : 0)};
  transition: opacity ${({ theme }) => theme.transitions.fast} ease;
  cursor: pointer;
  color: ${({ theme, $isPinned }) => ($isPinned ? theme.colors.spotify : theme.colors.foreground)};

  @media (hover: none) {
    opacity: 1;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

export const ProviderBadgeOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing.sm};
  left: ${({ theme }) => theme.spacing.sm};
  z-index: 2;
`;

export const PinnableGridCard = styled(GridCard)`
  &:hover ${GridCardPinOverlay} {
    opacity: 1;
  }
`;

export const PinnedSectionLabel = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  color: ${({ theme }) => theme.colors.gray[500]};
  font-size: 0.6875rem;
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.popover.border};
  }
`;
