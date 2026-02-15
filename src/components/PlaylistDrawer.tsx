import React, { Suspense, memo, useMemo } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

const Playlist = React.lazy(() => import('./Playlist'));

const PlaylistDrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen', 'width', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{ isOpen: boolean; width: number; transitionDuration: number; transitionEasing: string }>`
  position: fixed;
  top: 0;
  right: 0;
  width: ${({ width }) => width}px;
  height: 100vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing},
            width ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  padding: ${theme.spacing.md};
  box-sizing: border-box;
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: playlist;
  
  /* Container query responsive adjustments */
  @container playlist (max-width: ${theme.breakpoints.md}) {
    width: ${theme.drawer.widths.mobile};
    padding: ${theme.spacing.sm};
  }
  
  @container playlist (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.tablet};
    padding: ${theme.spacing.md};
  }
  
  @container playlist (min-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.desktop};
    padding: ${theme.spacing.lg};
  }
  
  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: ${theme.drawer.widths.mobile};
    }
  }
`;

const PlaylistContent = styled.div`
  padding: ${theme.spacing.sm} 0 ${theme.spacing.md} 0;
  
  /* Ensure playlist cards have proper spacing from top and bottom */
  > div:first-child {
    margin-top: 0;
  }
  
  > div:last-child {
    margin-bottom: 0;
  }
`;

const PlaylistOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen'].includes(prop),
}) <{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
  z-index: ${theme.zIndex.overlay};
`;

const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.md};
  padding-bottom: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.popover.border};
`;

const PlaylistTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xl};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};
  
  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

const PlaylistFallback = styled.div`
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${({ theme }) => theme.colors.gray[800]};
  border-radius: ${theme.borderRadius['2xl']};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.gray[700]};
`;

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrackIndex: number;
  accentColor: string;
  onTrackSelect: (index: number) => void;
}

// Custom comparison function for PlaylistDrawer memo optimization
const arePlaylistDrawerPropsEqual = (
  prevProps: PlaylistDrawerProps,
  nextProps: PlaylistDrawerProps
): boolean => {
  // Check if open state changed
  if (prevProps.isOpen !== nextProps.isOpen) {
    return false;
  }

  // Check if current track changed
  if (prevProps.currentTrackIndex !== nextProps.currentTrackIndex) {
    return false;
  }

  // Check accent color
  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }

  // Check if tracks array length changed (shallow check for performance)
  if (prevProps.tracks.length !== nextProps.tracks.length) {
    return false;
  }

  // For callbacks, we assume they're stable (parent should use useCallback)
  return true;
};

export const PlaylistDrawer = memo<PlaylistDrawerProps>(({
  isOpen,
  onClose,
  tracks,
  currentTrackIndex,
  accentColor,
  onTrackSelect
}) => {
  // Get responsive sizing information
  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  // Calculate responsive width for the drawer
  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs));
    if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet));
    return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop));
  }, [viewport.width, isMobile, isTablet]);
  return (
    <>
      <PlaylistOverlay
        isOpen={isOpen}
        onClick={onClose}
      />

      <PlaylistDrawerContainer
        isOpen={isOpen}
        width={drawerWidth}
        transitionDuration={transitionDuration}
        transitionEasing={transitionEasing}
      >
        <PlaylistHeader>
          <PlaylistTitle>Playlist</PlaylistTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </PlaylistHeader>

        <PlaylistContent>
          <Suspense fallback={
            <PlaylistFallback>
              <PlaylistFallbackCard>
                <div style={{
                  animation: theme.animations.pulse,
                  color: theme.colors.muted.foreground,
                  textAlign: 'center'
                }}>
                  Loading playlist...
                </div>
              </PlaylistFallbackCard>
            </PlaylistFallback>
          }>
            <Playlist
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              accentColor={accentColor}
              onTrackSelect={(index) => {
                onTrackSelect(index);
                onClose(); // Close drawer after selecting track
              }}
              isOpen={isOpen}
            />
          </Suspense>
        </PlaylistContent>
      </PlaylistDrawerContainer>
    </>
  );
}, arePlaylistDrawerPropsEqual);

PlaylistDrawer.displayName = 'PlaylistDrawer';

export default PlaylistDrawer;