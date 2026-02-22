import styled from 'styled-components';
import { theme } from '../../styles/theme';
import { getContrastColor } from '../../utils/colorUtils';

// --- Main Container ---
export const PlayerControlsContainer = styled.div<{ $isMobile: boolean; $isTablet: boolean; $compact?: boolean }>`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $isMobile, $compact }) => $compact ? theme.spacing.xs : $isMobile ? theme.spacing.sm : theme.spacing.sm};
  padding: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return `${theme.spacing.xs} ${theme.spacing.sm}`;
    if ($isTablet) return `${theme.spacing.sm} ${theme.spacing.md}`;
    return `${theme.spacing.sm} ${theme.spacing.md}`;
  }};
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: controls;
  
  /* Container query responsive adjustments */
  @container controls (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  }
  
  @container controls (min-width: ${({ theme }) => theme.breakpoints.sm}) and (max-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  }
  
  @container controls (min-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  }
`;

// --- Track Info Components ---
export const TrackInfoOnlyRow = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  margin-bottom: 0;
  margin-top: 0;
  position: relative;
  z-index: 10;
  text-shadow: ${({ theme }) => theme.shadows.textSm};

  @media (max-width: ${theme.breakpoints.lg}) {
    margin-top: 0;
    margin-bottom: 0;
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
  }
`;

export const PlayerTrackName = styled.div<{ $isMobile: boolean; $isTablet: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.fontSize.lg;
    if ($isTablet) return theme.fontSize.xl;
    return theme.fontSize['2xl'];
  }};
  line-height: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.fontSize.xl;
    if ($isTablet) return theme.fontSize['2xl'];
    return theme.fontSize['3xl'];
  }};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  position: relative;
  z-index: 11;
  text-shadow: ${({ theme }) => theme.shadows.textMd};
`;

export const PlayerTrackAlbum = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  line-height: ${({ theme }) => theme.fontSize.base};
  color: ${({ theme }) => theme.colors.gray[400]};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  position: relative;
  z-index: 11;
  text-shadow: ${({ theme }) => theme.shadows.textControl};
`;

export const AlbumLink = styled.a`
  color: inherit;
  text-decoration: none;
  transition: opacity ${({ theme }) => theme.transitions.fast} ease;
  background: none;
  border: none;
  font: inherit;
  padding: 0;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
`;

export const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: ${({ theme }) => theme.fontSize.base};
  color: ${({ theme }) => theme.colors.gray[300]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  position: relative;
  z-index: 11;
  text-shadow: ${({ theme }) => theme.shadows.textControl};
`;

export const ArtistLink = styled.a`
  color: inherit;
  text-decoration: none;
  transition: opacity ${({ theme }) => theme.transitions.fast} ease;
  background: none;
  border: none;
  font: inherit;
  padding: 0;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
`;

// --- Track Info Row Layout ---
export const TrackInfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
`;

export const TrackInfoLeft = styled.div`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export const TrackInfoCenter = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 8.5rem;
  gap: ${({ theme }) => theme.spacing.sm};
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
`;

export const TrackInfoRight = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

// --- Control Buttons ---
export const ControlButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['isActive', 'accentColor', '$isMobile', '$isTablet', '$compact'].includes(prop),
}) <{ isActive?: boolean; accentColor: string; $isMobile: boolean; $isTablet: boolean; $compact?: boolean }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation; /* Remove 300ms tap delay on iOS */
  transition: all 0.2s ease;
  padding: ${({ $isMobile, $isTablet, $compact, theme }) => {
    if ($compact) return theme.spacing.sm;
    if ($isMobile) return theme.spacing.sm;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.sm;
  }};
  border-radius: ${({ $isMobile, $isTablet, $compact, theme }) => {
    if ($compact) return theme.borderRadius.md;
    if ($isMobile) return theme.borderRadius.md;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};
  
  svg {
    width: ${({ $isMobile, $isTablet, $compact }) => {
    if ($compact) return '1.5rem';
    if ($isMobile) return '1.5rem';
    if ($isTablet) return '1.5rem';
    return '1.5rem';
  }};
    height: ${({ $isMobile, $isTablet, $compact }) => {
    if ($compact) return '1.5rem';
    if ($isMobile) return '1.5rem';
    if ($isTablet) return '1.5rem';
    return '1.5rem';
  }};
    fill: currentColor;
  }

  background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? accentColor : `${accentColor}33`};
  color: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? getContrastColor(accentColor) : theme.colors.white};
    
  &:hover {
    background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? `${accentColor}DD` : `${accentColor}4D`};
  }
`;

// --- Timeline Components ---
export const TimelineControlsContainer = styled.div<{ $isMobile?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: 0;
`;

export const TimelineRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
