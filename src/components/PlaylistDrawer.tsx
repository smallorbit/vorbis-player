import React, { Suspense, memo } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';

const Playlist = React.lazy(() => import('./Playlist'));

const PlaylistDrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen'].includes(prop),
}) <{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(10px);
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  padding: ${theme.spacing.md};
  box-sizing: border-box;
  
  @media (max-width: ${theme.breakpoints.sm}) {
    width: 100vw;
  }
`;

const PlaylistContent = styled.div`
  padding: 0.5rem 0 1rem 0;
  
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  transition: all 0.2s ease;
  
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
  border-radius: 1.25rem;
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
  return (
    <>
      <PlaylistOverlay
        isOpen={isOpen}
        onClick={onClose}
      />

      <PlaylistDrawerContainer isOpen={isOpen}>
        <PlaylistHeader>
          <PlaylistTitle>Playlist ({tracks.length} tracks)</PlaylistTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </PlaylistHeader>

        <PlaylistContent>
          <Suspense fallback={
            <PlaylistFallback>
              <PlaylistFallbackCard>
                <div style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  color: 'rgba(255, 255, 255, 0.6)',
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