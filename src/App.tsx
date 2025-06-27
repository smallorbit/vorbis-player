import { useEffect, useState } from 'react';
import AudioPlayerComponent from './components/AudioPlayer';
import { dropboxAuth } from './services/dropbox';
import { spotifyAuth } from './services/spotify';
// Import spotifyPlayer service to ensure global callback is set up
import './services/spotifyPlayer';

function App() {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const authenticate = async () => {
      try {
        if (window.location.pathname.includes('/auth/spotify/callback')) {
          await spotifyAuth.handleRedirect();
        } else if (window.location.pathname.includes('/auth/dropbox/callback')) {
          await dropboxAuth.handleRedirect();
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
      <div className="bg-neutral-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="bg-neutral-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Authentication Error: {authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              spotifyAuth.redirectToAuth();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 text-white min-h-screen flex items-center justify-center">
      <AudioPlayerComponent />
    </div>
  );
}

export default App;
