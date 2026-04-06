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
  align-items: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid ${theme.colors.borderSubtle};
  border: none;
  border-radius: 0;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background ${theme.transitions.fast};
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &:active {
    background: rgba(255, 255, 255, 0.14);
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
`;

export const ResumeTrackName = styled.div`
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.medium};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResumeCollectionName = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResumeLabel = styled.div`
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xs};
  font-weight: ${theme.fontWeight.medium};
  flex-shrink: 0;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: 1px solid ${theme.colors.borderSubtle};
  border-radius: ${theme.borderRadius.full};
`;

export const RingSection = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.sm};
  position: relative;
`;

export const RingContainer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 320px;
  max-height: 320px;
`;

export const CenterButton = styled.button`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: background ${theme.transitions.fast}, transform ${theme.transitions.fast};
  touch-action: manipulation;
  z-index: 1;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    transform: translate(-50%, -50%) scale(1.05);
  }

  &:active {
    transform: translate(-50%, -50%) scale(0.96);
  }
`;

export const CenterCount = styled.div`
  font-size: ${theme.fontSize.xs};
  color: rgba(255, 255, 255, 0.7);
  font-weight: ${theme.fontWeight.medium};
  line-height: 1;
`;

export const SatelliteButton = styled.button<{ $x: number; $y: number }>`
  position: absolute;
  width: 52px;
  height: 52px;
  left: calc(50% + ${({ $x }) => $x}px - 26px);
  top: calc(50% + ${({ $y }) => $y}px - 26px);
  border-radius: ${theme.borderRadius.lg};
  border: 1px solid ${theme.colors.borderSubtle};
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  overflow: hidden;
  transition: background ${theme.transitions.fast}, transform ${theme.transitions.fast};
  touch-action: manipulation;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.94);
  }
`;

export const SatelliteArt = styled.div`
  width: 100%;
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.control.background};
  font-size: 1.4rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const SatelliteName = styled.div`
  width: 100%;
  padding: 1px 3px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  line-height: 1.3;
  background: rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
`;

export const GhostSlot = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  width: 52px;
  height: 52px;
  left: calc(50% + ${({ $x }) => $x}px - 26px);
  top: calc(50% + ${({ $y }) => $y}px - 26px);
  border-radius: ${theme.borderRadius.lg};
  border: 1px dashed rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
`;

export const GhostHint = styled.div`
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  font-size: ${theme.fontSize.xs};
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  pointer-events: none;
  text-align: center;
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
