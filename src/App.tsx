import { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import AudioPlayerComponent from './components/AudioPlayer';
import { spotifyAuth } from './services/spotify';
import './services/spotifyPlayer';
import { ThemeProvider } from './styles/ThemeProvider';
import { flexCenter, buttonPrimary } from './styles/utils';
import { useDesktopIntegration } from './hooks/useDesktopIntegration';
import { DesktopWindowControls } from './components/DesktopWindowControls';
import { globalShortcuts } from './services/globalShortcuts';
import { desktopNotifications } from './services/desktopNotifications';
import { DesktopUtils } from './utils/desktopUtils';
import './styles/desktop.css';

const AppContainer = styled.div<{ isElectron: boolean; platformClass: string }>`
  background-color: ${({ theme, isElectron }) => 
    isElectron ? 'transparent' : theme.colors.background};
  color: ${({ theme }) => theme.colors.foreground};
  min-height: 100vh;
  ${flexCenter}
  position: relative;
  
  ${({ isElectron, platformClass }) => isElectron && `
    &.${platformClass} {
      /* Desktop-specific styling applied via CSS classes */
    }
  `}
`;

const LoadingContainer = styled.div`
  text-align: center;
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Spinner = styled.div`
  width: 3rem;
  height: 3rem;
  border: 2px solid transparent;
  border-bottom: 2px solid ${({ theme }) => theme.colors.white};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin: 0 auto ${({ theme }) => theme.spacing.md};
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const RetryButton = styled.button`
  ${buttonPrimary}
`;

const AlwaysOnTopIndicator = styled.div<{ isAlwaysOnTop: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: ${({ isAlwaysOnTop }) => 
    isAlwaysOnTop ? 'rgba(0, 255, 0, 0.6)' : 'transparent'};
  border-radius: 50%;
  animation: ${({ isAlwaysOnTop }) => isAlwaysOnTop ? 'pulse 2s infinite' : 'none'};
  z-index: 1001;
  pointer-events: none;
`;

function App() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const {
    isElectron,
    windowState,
    handleMouseDown,
    handleMouseUp
  } = useDesktopIntegration();

  const platformClass = DesktopUtils.getPlatformClass();

  useEffect(() => {
    const authenticate = async () => {
      try {
        if (window.location.pathname.includes('/auth/spotify/callback')) {
          await spotifyAuth.handleRedirect();
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'An unknown error occurred.');
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, []);

  // Initialize desktop features
  useEffect(() => {
    if (isElectron) {
      // Initialize global shortcuts
      globalShortcuts.initialize();
      
      // Request notification permission
      desktopNotifications.requestPermission();
      
      // Show connection notification
      desktopNotifications.showConnectionNotification(true);
    }

    return () => {
      if (isElectron) {
        globalShortcuts.destroy();
      }
    };
  }, [isElectron]);

  // Handle desktop-specific events
  useEffect(() => {
    const handleToggleWindow = () => {
      // This will be handled by the desktop integration hook
    };

    const handleToggleAlwaysOnTop = () => {
      // This will be handled by the desktop integration hook
    };

    const handleNotificationAction = (_event: Event) => {
      // Handle notification actions
      // The global shortcuts service will handle the actual actions
    };

    window.addEventListener('toggle-window', handleToggleWindow);
    window.addEventListener('toggle-always-on-top', handleToggleAlwaysOnTop);
    window.addEventListener('notification-action', handleNotificationAction);

    return () => {
      window.removeEventListener('toggle-window', handleToggleWindow);
      window.removeEventListener('toggle-always-on-top', handleToggleAlwaysOnTop);
      window.removeEventListener('notification-action', handleNotificationAction);
    };
  }, []);

  if (isAuthenticating) {
    return (
      <ThemeProvider>
        <AppContainer 
          isElectron={isElectron} 
          platformClass={platformClass}
          className={`app-container ${platformClass}`}
        >
          <LoadingContainer>
            <Spinner />
            <p>Checking authentication...</p>
          </LoadingContainer>
        </AppContainer>
      </ThemeProvider>
    );
  }

  if (authError) {
    return (
      <ThemeProvider>
        <AppContainer 
          isElectron={isElectron} 
          platformClass={platformClass}
          className={`app-container ${platformClass}`}
        >
          <LoadingContainer>
            <ErrorText>Authentication Error: {authError}</ErrorText>
            <RetryButton
              onClick={() => {
                setAuthError(null);
                spotifyAuth.redirectToAuth();
              }}
            >
              Try Again
            </RetryButton>
          </LoadingContainer>
        </AppContainer>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppContainer 
        isElectron={isElectron} 
        platformClass={platformClass}
        className={`app-container ${platformClass}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Desktop window controls */}
        <DesktopWindowControls />
        
        {/* Always-on-top indicator */}
        <AlwaysOnTopIndicator isAlwaysOnTop={windowState.isAlwaysOnTop} />
        
        {/* Main audio player component */}
        <AudioPlayerComponent />
      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
