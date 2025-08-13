import { spotifyAuth } from './spotify';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
}

class DesktopSpotifyAuthService {
  private authState: AuthState = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    isAuthenticated: false
  };
  private isElectron: boolean;
  private authWindow: Window | null = null;
  private authPromise: Promise<boolean> | null = null;

  constructor() {
    this.isElectron = !!(window as any).electronAPI?.isElectron;
    this.loadStoredTokens();
  }

  private async loadStoredTokens(): Promise<void> {
    if (!this.isElectron) return;

    try {
      // In Electron, tokens are stored securely by the main process
      // This is a placeholder for the actual implementation
      const storedTokens = localStorage.getItem('spotify_tokens');
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens);
        this.authState = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          isAuthenticated: this.isTokenValid(tokens.accessToken, tokens.expiresAt)
        };
      }
    } catch (error) {
      console.error('Error loading stored tokens:', error);
    }
  }

  private async storeTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }): Promise<void> {
    if (!this.isElectron) return;

    try {
      // In Electron, this would use the main process to store tokens securely
      localStorage.setItem('spotify_tokens', JSON.stringify(tokens));
      this.authState = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        isAuthenticated: true
      };
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  private isTokenValid(token: string | null, expiresAt: number | null): boolean {
    if (!token || !expiresAt) return false;
    return Date.now() < expiresAt;
  }

  async authenticate(): Promise<boolean> {
    if (this.authState.isAuthenticated && this.isTokenValid(this.authState.accessToken, this.authState.expiresAt)) {
      return true;
    }

    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.performAuthentication();
    return this.authPromise;
  }

  private async performAuthentication(): Promise<boolean> {
    try {
      if (this.isElectron) {
        return await this.authenticateInElectron();
      } else {
        return await this.authenticateInBrowser();
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    } finally {
      this.authPromise = null;
    }
  }

  private async authenticateInElectron(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create a popup window for OAuth
        const authUrl = await spotifyAuth.getAuthUrl();
        const width = 500;
        const height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        this.authWindow = window.open(
          authUrl,
          'spotify-auth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!this.authWindow) {
          reject(new Error('Failed to open authentication window'));
          return;
        }

        // Listen for the callback
        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data.type !== 'spotify-auth-callback') return;

          window.removeEventListener('message', handleMessage);
          
          if (this.authWindow) {
            this.authWindow.close();
            this.authWindow = null;
          }

          const { code, error } = event.data;

          if (error) {
            reject(new Error(`Authentication error: ${error}`));
            return;
          }

          try {
            const tokens = await this.exchangeCodeForTokens(code);
            await this.storeTokens(tokens);
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };

        window.addEventListener('message', handleMessage);

        // Handle window close
        const checkClosed = setInterval(() => {
          if (this.authWindow?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Authentication window was closed'));
          }
        }, 1000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async authenticateInBrowser(): Promise<boolean> {
    // Fallback to the existing web authentication
    try {
      await spotifyAuth.redirectToAuth();
      return true;
    } catch (error) {
      console.error('Browser authentication failed:', error);
      return false;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }> {
    // Use the existing spotifyAuth service to exchange the code
    const response = await fetch('/api/spotify/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    };
  }

  async refreshToken(): Promise<boolean> {
    if (!this.authState.refreshToken) {
      return false;
    }

    try {
      const response = await fetch('/api/spotify/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          refresh_token: this.authState.refreshToken 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      await this.storeTokens({
        accessToken: data.access_token,
        refreshToken: this.authState.refreshToken, // Keep the same refresh token
        expiresAt: Date.now() + (data.expires_in * 1000)
      });

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.authState.isAuthenticated) {
      const authenticated = await this.authenticate();
      if (!authenticated) return null;
    }

    // Check if token needs refresh
    if (this.authState.expiresAt && Date.now() >= this.authState.expiresAt - 60000) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        // Refresh failed, need to re-authenticate
        this.authState.isAuthenticated = false;
        const reAuthenticated = await this.authenticate();
        if (!reAuthenticated) return null;
      }
    }

    return this.authState.accessToken;
  }

  async logout(): Promise<void> {
    this.authState = {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false
    };

    if (this.isElectron) {
      localStorage.removeItem('spotify_tokens');
    }

    // Close any open auth window
    if (this.authWindow) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && 
           this.isTokenValid(this.authState.accessToken, this.authState.expiresAt);
  }

  // Handle OAuth callback in the popup window
  static handleCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (window.opener) {
      window.opener.postMessage({
        type: 'spotify-auth-callback',
        code,
        error
      }, window.location.origin);
      window.close();
    }
  }
}

export const desktopSpotifyAuth = new DesktopSpotifyAuthService();