import { useEffect, useState } from 'react';
import AudioPlayerComponent from './components/AudioPlayer';
import { dropboxAuth } from './services/dropbox';

function App() {
  const [isHandlingAuth, setIsHandlingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      console.log('Current URL:', window.location.href);
      console.log('Pathname:', window.location.pathname);
      console.log('Code:', code);
      
      if (code && window.location.pathname === '/auth/dropbox/callback') {
        // Check if we've already processed this code
        const processedCode = sessionStorage.getItem('dropbox_processed_code');
        const processingInProgress = sessionStorage.getItem('dropbox_processing');
        
        if (processedCode === code || processingInProgress === code) {
          console.log('Code already processed or currently processing, skipping...');
          // If we're authenticated, redirect home
          if (dropboxAuth.isAuthenticated()) {
            window.history.replaceState({}, document.title, '/');
          }
          return;
        }

        console.log('Handling auth callback...');
        setIsHandlingAuth(true);
        
        // Mark this code as being processed
        sessionStorage.setItem('dropbox_processing', code);
        
        try {
          await dropboxAuth.handleAuthCallback(code);
          console.log('Auth successful, redirecting to home...');
          // Mark as successfully processed
          sessionStorage.setItem('dropbox_processed_code', code);
          sessionStorage.removeItem('dropbox_processing');
          window.history.replaceState({}, document.title, '/');
        } catch (error) {
          console.error('Auth callback failed:', error);
          setAuthError(error instanceof Error ? error.message : 'Authentication failed');
          // Clear processing markers on error so it can be retried
          sessionStorage.removeItem('dropbox_processing');
          sessionStorage.removeItem('dropbox_processed_code');
        } finally {
          setIsHandlingAuth(false);
        }
      }
    };

    handleAuthCallback();
  }, []);

  if (isHandlingAuth) {
    return (
      <div className="bg-neutral-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Completing Dropbox authentication...</p>
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
              dropboxAuth.redirectToAuth();
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
