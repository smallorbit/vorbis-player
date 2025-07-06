import React, { Suspense } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';

const Playlist = React.lazy(() => import('./Playlist'));

const PlaylistDrawerContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow-y: auto;
  padding: 1rem;
  box-sizing: border-box;
  
  @media (max-width: 480px) {
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

const PlaylistOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 999;
`;

const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const PlaylistTitle = styled.h3`
  color: white;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const PlaylistFallback = styled.div`
  width: 100%;
  margin-top: ${({ theme }: any) => theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${({ theme }: any) => theme.colors.gray[800]};
  border-radius: 1.25rem;
  padding: ${({ theme }: any) => theme.spacing.md};
  border: 1px solid ${({ theme }: any) => theme.colors.gray[700]};
`;

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrackIndex: number;
  accentColor: string;
  onTrackSelect: (index: number) => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
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
            />
          </Suspense>
        </PlaylistContent>
      </PlaylistDrawerContainer>
    </>
  );
};

export default PlaylistDrawer;