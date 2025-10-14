import styled from 'styled-components';
import { theme } from '../../styles/theme';

// --- Main Container ---
export const PlayerControlsContainer = styled.div<{ $isMobile: boolean; $isTablet: boolean }>`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $isMobile }) => $isMobile ? theme.spacing.xs : theme.spacing.sm};
  padding: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return `${theme.spacing.sm} ${theme.spacing.sm}`;
    if ($isTablet) return `${theme.spacing.sm} ${theme.spacing.md}`;
    return `${theme.spacing.sm} ${theme.spacing.lg}`;
  }};
  width: 100%;
  max-width: 100%;
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: controls;
  
  /* Container query responsive adjustments */
  @container controls (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.sm}`};
  }
  
  @container controls (min-width: ${({ theme }) => theme.breakpoints.sm}) and (max-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  }
  
  @container controls (min-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.lg}`};
  }
`;

// --- Track Info Components ---
export const TrackInfoOnlyRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
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
`;

export const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  line-height: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[300]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
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
  gap: ${({ theme }) => theme.spacing.xs};
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
  shouldForwardProp: (prop) => !['isActive', 'accentColor', '$isMobile', '$isTablet'].includes(prop),
}) <{ isActive?: boolean; accentColor: string; $isMobile: boolean; $isTablet: boolean }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.spacing.xs;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.sm;
  }};
  border-radius: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.borderRadius.sm;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};
  
  svg {
    width: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return '1.25rem';
    if ($isTablet) return '1.375rem';
    return '1.5rem';
  }};
    height: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return '1.25rem';
    if ($isTablet) return '1.375rem';
    return '1.5rem';
  }};
    fill: currentColor;
  }

  background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? accentColor : theme.colors.control.background};
  color: ${theme.colors.white};
    
  &:hover {
    background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? `${accentColor}4D` : theme.colors.control.backgroundHover};
  }
`;

export const VolumeButton = styled.button<{ $isMobile: boolean; $isTablet: boolean }>`
  border: none;
  background: transparent;
  color: ${theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.spacing.xs;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.xs;
  }};
  border-radius: ${({ $isMobile, $isTablet, theme }) => {
    if ($isMobile) return theme.borderRadius.sm;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
  }
  
  svg {
    width: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return '1.25rem';
    if ($isTablet) return '1.375rem';
    return '1.5rem';
  }};
    height: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return '1.25rem';
    if ($isTablet) return '1.375rem';
    return '1.5rem';
  }};
    fill: currentColor;
  }
`;

// --- Timeline Components ---
export const TimelineControlsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const TimelineLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const TimelineRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;
