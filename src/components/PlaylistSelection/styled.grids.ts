import styled from 'styled-components';
import { theme } from '@/styles/theme';

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

export const PlaylistNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
  margin-bottom: 0.25rem;

  & > :first-child {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: ${({ theme }) => theme.fontWeight.semibold};
    font-size: ${({ theme }) => theme.fontSize.base};
    color: ${({ theme }) => theme.colors.white};
  }
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

export const CollectionTypeLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: ${({ theme }) => theme.colors.muted.foreground};
  flex-shrink: 0;

  svg {
    width: 0.75em;
    height: 0.75em;
    opacity: 0.7;
  }
`;

export const GridCardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;

  & > :first-child {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
