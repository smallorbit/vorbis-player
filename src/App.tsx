import { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import AudioPlayerComponent from './components/AudioPlayer';
import { spotifyAuth } from './services/spotify';
import { ThemeProvider } from './styles/ThemeProvider';
import { flexCenter, buttonPrimary } from './styles/utils';
import { AuthCallbackPage } from './components/AuthCallbackPage';
import { TrackProvider } from './contexts/TrackContext';
import { VisualEffectsProvider } from './contexts/VisualEffectsContext';
import { VisualizerDebugProvider } from './contexts/VisualizerDebugContext';
import { ColorProvider } from './contexts/ColorContext';
import { PinnedItemsProvider } from './contexts/PinnedItemsContext';
import { PlayerSizingProvider } from './contexts/PlayerSizingContext';
import { VisualizerDebugPanel } from './components/VisualizerDebugPanel';
import { ProviderProvider } from './contexts/ProviderContext';
import { providerRegistry } from './providers/registry';
import { getLikesSync } from './providers/dropbox/dropboxLikesSync';
import { getPreferencesSync } from './providers/dropbox/dropboxPreferencesSync';
import { AUTH_COMPLETE_EVENT } from '@/constants/events';
import { logApp } from '@/lib/debugLog';
import { DevBugProvider } from '@/contexts/DevBugContext';
import { DevBugFAB } from '@/components/DevBug';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Cleanup function to remove deprecated localStorage keys
 * 
 * This function removes the old 'customAccentColorOverrides' key from localStorage
 * as part of the migration to unified accent color state management in usePlayerState.
 * 
 * @function cleanupDeprecatedLocalStorage
 * @returns {void}
 * 
 * @throws {Error} If localStorage access fails
 * 
 * @example
 * ```typescript
 * // Called on app initialization
 * cleanupDeprecatedLocalStorage();
 * ```
 */
const cleanupDeprecatedLocalStorage = () => {
  try {
    // Remove the deprecated customAccentColorOverrides key
    localStorage.removeItem('customAccentColorOverrides');
    logApp('cleaned up deprecated localStorage key: customAccentColorOverrides');
  } catch (error) {
    console.warn('Failed to clean up deprecated localStorage keys:', error);
  }
};

const AppContainer = styled.div`
  color: ${({ theme }) => theme.colors.foreground};
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  ${flexCenter}
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

function App() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPopupCallback, setIsPopupCallback] = useState(false);
  const [devbugEnabled] = useLocalStorage(STORAGE_KEYS.DEVBUG_ENABLED, false);

  useEffect(() => {
    // Clean up deprecated localStorage keys on app initialization
    cleanupDeprecatedLocalStorage();

    const authenticate = async () => {
      try {
        // Route auth callbacks through registered providers
        const currentUrl = new URL(window.location.href);
        const isAuthCallback = currentUrl.pathname.startsWith('/auth/');

        if (isAuthCallback) {
          let handled = false;
          let handledProviderId: string | null = null;
          for (const descriptor of providerRegistry.getAll()) {
            try {
              const result = await descriptor.auth.handleCallback(currentUrl);
              if (result) {
                handled = true;
                handledProviderId = descriptor.id;
                break;
              }
            } catch (providerError) {
              throw providerError;
            }
          }

          // Trigger likes and preferences sync after Dropbox login
          if (handled && handledProviderId === 'dropbox') {
            getLikesSync()?.initialSync().catch((err) => {
              console.warn('[App] Post-login Dropbox likes sync failed:', err);
            });
            getPreferencesSync()?.initialSync().catch((err) => {
              console.warn('[App] Post-login Dropbox preferences sync failed:', err);
            });
          }

          if (handled && window.opener) {
            window.opener.postMessage(
              { type: AUTH_COMPLETE_EVENT, provider: handledProviderId },
              window.location.origin,
            );
            setIsPopupCallback(true);
            setTimeout(() => window.close(), 1500);
          } else if (handled) {
            window.history.replaceState({}, document.title, '/');
          }

          if (!handled && currentUrl.pathname.includes('/auth/spotify/callback')) {
            await spotifyAuth.handleRedirect();
          }
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'An unknown error occurred.');
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, []);


  if (isAuthenticating) {
    return (
      <ThemeProvider>
        <AppContainer>
          <LoadingContainer>
            <Spinner />
            <p>Checking authentication...</p>
          </LoadingContainer>
        </AppContainer>
      </ThemeProvider>
    );
  }

  if (isPopupCallback) {
    return (
      <ThemeProvider>
        <AuthCallbackPage />
      </ThemeProvider>
    );
  }

  if (authError) {
    return (
      <ThemeProvider>
        <AppContainer>
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

  const player = (
    <ThemeProvider>
      <ProviderProvider>
        <PlayerSizingProvider>
        <VisualizerDebugProvider>
          <TrackProvider>
            <VisualEffectsProvider>
              <ColorProvider>
                <PinnedItemsProvider>
                <AppContainer>
                  <AudioPlayerComponent />
                </AppContainer>
              </PinnedItemsProvider>
              <VisualizerDebugPanel />
            </ColorProvider>
          </VisualEffectsProvider>
        </TrackProvider>
      </VisualizerDebugProvider>
      </PlayerSizingProvider>
      </ProviderProvider>
    </ThemeProvider>
  );

  if (import.meta.env.DEV) {
    return (
      <DevBugProvider>
        {player}
        {devbugEnabled && <DevBugFAB />}
      </DevBugProvider>
    );
  }

  return player;
}

export default App;
