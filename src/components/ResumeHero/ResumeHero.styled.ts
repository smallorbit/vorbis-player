import styled from 'styled-components';
import { theme } from '@/styles/theme';

export const LibraryRoot = styled.section`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.md};
  margin: 0 ${theme.spacing.md};
  border-radius: ${theme.borderRadius.lg};
  background: ${theme.colors.muted.background};
  border: 1px solid ${theme.colors.borderSubtle};
`;

export const LibraryArt = styled.div`
  width: 120px;
  height: 120px;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  background: ${theme.colors.muted.background};
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  span {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
`;

export const LibraryText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  flex: 1;
  min-width: 0;
`;

export const LibraryTrackName = styled.div`
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.lg};
  font-weight: ${theme.fontWeight.semibold};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const LibraryArtistName = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.sm};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const LibraryCollectionName = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const LibraryResumeButton = styled.button`
  appearance: none;
  background: ${theme.colors.cta};
  color: ${theme.colors.white};
  border: none;
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.full};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.ctaHover};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.white};
    outline-offset: 2px;
  }
`;

export const PanelSection = styled.section`
  position: relative;
  flex-shrink: 0;
  margin: ${theme.spacing.md} ${theme.spacing.md} 0;
  padding: ${theme.spacing.md};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  border-radius: ${theme.borderRadius['2xl']};
  border: 1px solid rgba(255, 255, 255, 0.14);
  background:
    linear-gradient(135deg, rgba(100, 108, 255, 0.22) 0%, rgba(144, 82, 82, 0.18) 100%),
    rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: ${theme.shadows.drop};
  overflow: hidden;
`;

export const PanelArt = styled.div`
  width: 88px;
  height: 88px;
  border-radius: ${theme.borderRadius.xl};
  overflow: hidden;
  flex-shrink: 0;
  background: ${theme.colors.control.background};
  box-shadow: ${theme.shadows.albumArtDepth};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const PanelText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const PanelEyebrow = styled.span`
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.semibold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
`;

export const PanelTitle = styled.span`
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.bold};
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const PanelSubtitle = styled.span`
  font-size: ${theme.fontSize.sm};
  color: ${theme.colors.muted.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const PanelResumeButton = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.full};
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.94);
  color: #111;
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  cursor: pointer;
  touch-action: manipulation;
  transition: background ${theme.transitions.fast}, transform ${theme.transitions.fast};

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: #ffffff;
  }

  &:active {
    transform: scale(0.97);
  }
`;
