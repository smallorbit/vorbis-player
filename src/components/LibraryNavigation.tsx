import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from './styled/Button';
import LocalLibraryBrowser from './LocalLibraryBrowser';
import LocalLibrarySettings from './LocalLibrarySettings';
import PlaylistSelection from './PlaylistSelection';
import type { LocalTrack } from '../types/spotify.d.ts';
import { isElectron } from '../utils/environment';

const NavigationContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  -webkit-app-region: no-drag;
  pointer-events: auto;
`;

const NavigationHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 8px;
`;

const NavButton = styled(Button) <{ active: boolean }>`
  flex: 1;
  background: ${props => props.active ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  color: ${props => props.active ? 'white' : 'rgba(255, 255, 255, 0.7)'};
  border: 1px solid ${props => props.active ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const ViewContainer = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const LocalViewSelector = styled.div`
  display: flex;
  gap: 8px;
  padding: 16px 20px 0;
`;

const LocalViewButton = styled(Button) <{ active: boolean }>`
  background: ${props => props.active ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  color: ${props => props.active ? 'white' : 'rgba(255, 255, 255, 0.6)'};
  border: 1px solid ${props => props.active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  padding: 8px 16px;
  font-size: 12px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 16px 0 0;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: 40px 20px;
`;

const EmptyTitle = styled.h3`
  color: white;
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 8px 0;
`;

const EmptyDescription = styled.p`
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const SetupButton = styled(Button)`
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  color: #007bff;
  padding: 12px 24px;
  font-weight: 500;
  
  &:hover {
    background: rgba(0, 123, 255, 0.3);
    border-color: rgba(0, 123, 255, 0.6);
  }
`;

const CloseButton = styled(Button)`
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  margin-left: auto;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

type LibrarySource = 'spotify' | 'local';
type LocalView = 'browser' | 'settings';

interface LibraryNavigationProps {
  onTrackSelect?: (track: LocalTrack) => void;
  onQueueTracks?: (tracks: LocalTrack[], startIndex?: number) => void;
  onPlaylistSelect?: (playlistId: string) => void;
  showPlaylist?: boolean;
  activeSource?: 'spotify' | 'local';
  onClose?: () => void;
}

export const LibraryNavigation: React.FC<LibraryNavigationProps> = ({
  onTrackSelect,
  onQueueTracks,
  onPlaylistSelect,
  showPlaylist = false,
  activeSource: externalActiveSource,
  onClose
}) => {
  const [internalActiveSource, setInternalActiveSource] = useState<LibrarySource>(() =>
    isElectron() ? 'local' : 'spotify'
  );

  // Use external active source if provided, otherwise use internal state
  const activeSource = externalActiveSource || internalActiveSource;
  
  // Update internal state when external activeSource changes
  React.useEffect(() => {
    if (externalActiveSource && externalActiveSource !== internalActiveSource) {
      setInternalActiveSource(externalActiveSource);
    }
  }, [externalActiveSource, internalActiveSource]);
  const [localView, setLocalView] = useState<LocalView>('browser');
  const [hasLocalLibrary, setHasLocalLibrary] = useState(false);

  // Check if local library has been set up
  React.useEffect(() => {
    const checkLocalLibrary = async () => {
      try {
        if (window.electronAPI) {
          const settings = await window.electronAPI.scannerGetSettings();
          const hasDirectories = settings.musicDirectories?.length > 0;
          console.log('📂 LibraryNavigation: Checking local library setup:', {
            hasDirectories,
            directoriesCount: settings.musicDirectories?.length || 0
          });
          setHasLocalLibrary(hasDirectories);
        } else {
          // Fallback for web version
          const settings = JSON.parse(localStorage.getItem('localLibrarySettings') || '{}');
          setHasLocalLibrary(settings.musicDirectories?.length > 0);
        }
      } catch (error) {
        console.error('Failed to check local library setup:', error);
        setHasLocalLibrary(false);
      }
    };

    checkLocalLibrary();

    // Poll for settings changes every 2 seconds
    const pollInterval = setInterval(checkLocalLibrary, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const handleSetupLocalLibrary = () => {
    setInternalActiveSource('local');
    setLocalView('settings');
  };

  const renderSpotifyView = () => {
    return (
      <PlaylistSelection
        onPlaylistSelect={onPlaylistSelect}
        showPlaylist={showPlaylist}
      />
    );
  };

  const renderLocalView = () => {
    if (!hasLocalLibrary && localView === 'browser') {
      return (
        <EmptyState>
          <EmptyTitle>Local Music Library</EmptyTitle>
          <EmptyDescription>
            Add your music directories to get started with your local music collection.
            Supports FLAC, MP3, WAV, OGG, M4A, and AAC files.
          </EmptyDescription>
          <SetupButton onClick={handleSetupLocalLibrary}>
            Set Up Local Library
          </SetupButton>
        </EmptyState>
      );
    }

    switch (localView) {
      case 'browser':
        return (
          <LocalLibraryBrowser
            onTrackSelect={onTrackSelect}
            onQueueTracks={onQueueTracks}
          />
        );
      case 'settings':
        return <LocalLibrarySettings />;
      default:
        return null;
    }
  };

  return (
    <NavigationContainer>
      <NavigationHeader>
        {!isElectron() && (
          <NavButton
            active={activeSource === 'spotify'}
            onClick={() => setInternalActiveSource('spotify')}
          >
            🎵 Spotify
          </NavButton>
        )}
        <NavButton
          active={activeSource === 'local'}
          onClick={() => setInternalActiveSource('local')}
        >
          💿 Local Music
        </NavButton>
        {isElectron() && onClose && (
          <CloseButton
            onClick={onClose}
            title="Close Library"
            aria-label="Close Library"
          >
            ✕
          </CloseButton>
        )}
      </NavigationHeader>

      <ViewContainer>
        {activeSource === 'local' && (
          <LocalViewSelector>
            <LocalViewButton
              active={localView === 'browser'}
              onClick={async () => {
                setLocalView('browser');
                // Refresh library status when switching to Library view
                try {
                  if (window.electronAPI) {
                    const settings = await window.electronAPI.scannerGetSettings();
                    const hasDirectories = settings.musicDirectories?.length > 0;
                    console.log('📂 LibraryNavigation: Refreshed on Library click:', {
                      hasDirectories,
                      directoriesCount: settings.musicDirectories?.length || 0
                    });
                    setHasLocalLibrary(hasDirectories);
                  }
                } catch (error) {
                  console.error('Failed to refresh library status:', error);
                }
              }}
            >
              Library
            </LocalViewButton>
            <LocalViewButton
              active={localView === 'settings'}
              onClick={() => setLocalView('settings')}
            >
              Settings
            </LocalViewButton>
          </LocalViewSelector>
        )}

        <ContentArea>
          {activeSource === 'spotify' && renderSpotifyView()}
          {activeSource === 'local' && renderLocalView()}
        </ContentArea>
      </ViewContainer>
    </NavigationContainer>
  );
};

export default LibraryNavigation;