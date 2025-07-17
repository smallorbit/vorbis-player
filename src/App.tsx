import { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import AudioPlayerComponent from './components/AudioPlayer';
import { spotifyAuth } from './services/spotify';
import './services/spotifyPlayer';
import { ThemeProvider } from './styles/ThemeProvider';
import { flexCenter, buttonPrimary } from './styles/utils';

const AppContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.foreground};
  min-height: 100vh;
  
  /* Desktop and tablet - use flex centering */
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    ${flexCenter}
  }
  
  /* Mobile - no flex centering, full width */
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
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

  return (
    <ThemeProvider>
      <AppContainer>
        <AudioPlayerComponent />

      </AppContainer>
    </ThemeProvider>
  );
}

export default App;
