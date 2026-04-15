import styled, { keyframes } from 'styled-components';
import { theme } from '@/styles/theme';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const PanelRoot = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid ${theme.colors.border};
  box-shadow: ${theme.shadows.albumArt};
  background: ${theme.colors.muted.background};
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  animation: ${fadeIn} 0.25s ease-out;
`;

export const ResumeCardRoot = styled.button`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  border-top: 1px solid ${theme.colors.borderSubtle};
  border-radius: 0;
  cursor: pointer;
  color: ${theme.colors.foreground};
  text-align: left;
  transition: background ${theme.transitions.fast};

  &:hover {
    background: rgba(0, 0, 0, 0.75);
  }

  &:active {
    background: rgba(0, 0, 0, 0.85);
  }
`;

export const ResumeArt = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  flex-shrink: 0;
  background: ${theme.colors.control.background};
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const ResumeText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const ResumeTrackName = styled.span`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResumeCollectionName = styled.span`
  font-size: ${theme.fontSize.xs};
  color: ${theme.colors.muted.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResumePlayButton = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: ${theme.spacing.xs};
  color: ${theme.colors.muted.foreground};

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const GridSection = styled.div`
  flex: 1;
  min-height: 0;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  container-type: size;
`;

export const GridContainer = styled.div`
  --grid-size: min(100cqi, 100cqb);
  width: var(--grid-size);
  height: var(--grid-size);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 6px;
`;

export const LikedSongsCard = styled.button`
  grid-column: 2 / 4;
  grid-row: 2 / 4;
  border-radius: ${theme.borderRadius.xl};
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  overflow: hidden;
  transition: filter ${theme.transitions.fast}, transform ${theme.transitions.fast};
  touch-action: manipulation;

  &:hover {
    filter: brightness(1.12);
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.97);
  }
`;

export const LikedSongsHeart = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const LikedSongsCount = styled.div`
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.bold};
  color: rgba(255, 255, 255, 0.95);
  line-height: 1;
`;

export const LikedSongsLabel = styled.div`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
  line-height: 1.2;
`;

export const GridItem = styled.button`
  position: relative;
  border-radius: ${theme.borderRadius.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: background ${theme.transitions.fast}, transform ${theme.transitions.fast};
  touch-action: manipulation;
  min-height: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

export const GridItemArt = styled.div`
  position: absolute;
  inset: 0;
  bottom: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.control.background};
  font-size: 1.2rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const GridItemName = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 18px;
  padding: 1px 4px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  line-height: 16px;
  background: rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
`;

export const GridGhostSlot = styled.div`
  border-radius: ${theme.borderRadius.md};
  border: 1px dashed rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
`;

export const GridEmptyHint = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSize.xs};
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  pointer-events: none;
  padding: ${theme.spacing.md};
`;

export const ChipsSection = styled.div`
  display: flex;
  justify-content: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  flex-shrink: 0;
  flex-wrap: wrap;
`;

export const BrowseSection = styled.div`
  display: flex;
  justify-content: center;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  flex-shrink: 0;
`;

export const BrowseButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid ${theme.colors.borderSubtle};
  border-radius: ${theme.borderRadius.full};
  color: ${theme.colors.foreground};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  padding: ${theme.spacing.xs} ${theme.spacing.lg};
  cursor: pointer;
  transition: background ${theme.transitions.fast};
  touch-action: manipulation;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  &:active {
    transform: scale(0.97);
  }
`;
