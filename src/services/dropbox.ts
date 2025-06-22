import { Dropbox } from 'dropbox';

const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
const DROPBOX_REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI;

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface PKCEData {
  code_verifier: string;
  code_challenge: string;
}

class DropboxAuth {
  private tokenData: TokenData | null = null;
  private dbx: Dropbox | null = null;
  private pkceData: PKCEData | null = null;

  constructor() {
    this.loadTokenFromStorage();
    this.initializeDropbox();
  }

  private loadTokenFromStorage() {
    const stored = localStorage.getItem('dropbox_token');
    if (stored) {
      try {
        const tokenData = JSON.parse(stored);
        // Check if token is expired (if it has an expiry)
        if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
          console.log('Stored token is expired, clearing...');
          localStorage.removeItem('dropbox_token');
          return;
        }
        this.tokenData = tokenData;
      } catch (e) {
        console.error('Failed to parse stored token:', e);
        localStorage.removeItem('dropbox_token');
      }
    }
  }

  private saveTokenToStorage(tokenData: TokenData) {
    this.tokenData = tokenData;
    localStorage.setItem('dropbox_token', JSON.stringify(tokenData));
  }

  private initializeDropbox() {
    if (this.tokenData?.access_token) {
      console.log('Initializing Dropbox with access token:', this.tokenData.access_token);
      this.dbx = new Dropbox({ 
        clientId: DROPBOX_APP_KEY,
        accessToken: this.tokenData.access_token,
        fetch: fetch.bind(window)
      });
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  public async getAuthUrl(): Promise<string> {
    if (!DROPBOX_APP_KEY) {
      throw new Error("VITE_DROPBOX_APP_KEY is not defined. Please set it in your .env.local file.");
    }

    const code_verifier = this.generateCodeVerifier();
    const code_challenge = await this.generateCodeChallenge(code_verifier);
    
    this.pkceData = { code_verifier, code_challenge };
    localStorage.setItem('dropbox_pkce', JSON.stringify(this.pkceData));

    const params = new URLSearchParams({
      client_id: DROPBOX_APP_KEY,
      response_type: 'code',
      redirect_uri: DROPBOX_REDIRECT_URI,
      token_access_type: 'offline',
      code_challenge: code_challenge,
      code_challenge_method: 'S256'
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  public async handleAuthCallback(code: string): Promise<void> {
    if (!DROPBOX_APP_KEY) {
      throw new Error("VITE_DROPBOX_APP_KEY is not defined.");
    }

    // Load PKCE data from localStorage
    const storedPkce = localStorage.getItem('dropbox_pkce');
    if (!storedPkce) {
      throw new Error('PKCE data not found. Please restart the authentication flow.');
    }

    try {
      const pkceData = JSON.parse(storedPkce);
      
      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: DROPBOX_APP_KEY,
          redirect_uri: DROPBOX_REDIRECT_URI,
          code_verifier: pkceData.code_verifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange error:', errorText);
        // Clear any existing expired tokens to force fresh authentication
        this.clearStoredTokens();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const tokenData: TokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
      };

      this.saveTokenToStorage(tokenData);
      this.initializeDropbox();
      
      // Clean up PKCE data
      localStorage.removeItem('dropbox_pkce');
    } catch (error) {
      console.error('Token exchange failed:', error);
      localStorage.removeItem('dropbox_pkce');
      // Clear any existing expired tokens to force fresh authentication
      this.clearStoredTokens();
      throw error;
    }
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    if (!DROPBOX_APP_KEY) {
      throw new Error("VITE_DROPBOX_APP_KEY is not defined.");
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokenData.refresh_token,
          client_id: DROPBOX_APP_KEY,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      const tokenData: TokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || this.tokenData.refresh_token,
        expires_at: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
      };

      this.saveTokenToStorage(tokenData);
      this.initializeDropbox();
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  public async ensureValidToken(): Promise<void> {
    if (!this.tokenData) {
      console.log('No authentication token available');
      throw new Error('No authentication token available');
    }
    console.log('Token data:', this.tokenData);

    // If token has expiry info and is expired/about to expire
    if (this.tokenData.expires_at && Date.now() > this.tokenData.expires_at - 300000) {
      await this.refreshAccessToken();
      return;
    }
    
    // For tokens without expiry info, try a quick test call to verify validity
    if (!this.tokenData.expires_at) {
      try {
        await this.dbx?.usersGetCurrentAccount();
      } catch (error) {
        const errorObj = error as { status?: number };
        if (errorObj?.status === 401) {
          console.log('Token validation failed, clearing expired token');
          this.clearStoredTokens();
          throw new Error('Authentication token is invalid');
        }
        throw error;
      }
    }
  }

  public isAuthenticated(): boolean {
    return !!this.tokenData?.access_token;
  }

  public getDropboxInstance(): Dropbox {
    if (!this.dbx) {
      throw new Error('Dropbox client not initialized. Please authenticate first.');
    }
    return this.dbx;
  }

  public async redirectToAuth(): Promise<void> {
    const authUrl = await this.getAuthUrl();
    window.location.href = authUrl;
  }

  public logout(): void {
    this.tokenData = null;
    this.dbx = null;
    localStorage.removeItem('dropbox_token');
    // Also clear PKCE data just in case
    localStorage.removeItem('dropbox_pkce');
  }

  public async handleRedirect(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      this.logout();
      throw new Error(`Dropbox auth error: ${error} - ${errorDescription}`);
    }

    if (code && window.location.pathname === '/auth/dropbox/callback') {
      const processedCode = sessionStorage.getItem('dropbox_processed_code');
      if (processedCode === code) {
        console.log('Code already processed, redirecting...');
        window.history.replaceState({}, document.title, '/');
        return;
      }

      try {
        await this.handleAuthCallback(code);
        sessionStorage.setItem('dropbox_processed_code', code);
        window.history.replaceState({}, document.title, '/');
      } catch (e) {
        sessionStorage.removeItem('dropbox_processed_code');
        this.logout();
        throw e;
      }
    }
  }

  public clearStoredTokens(): void {
    this.tokenData = null;
    this.dbx = null;
    this.logout();
  }
}

const dropboxAuth = new DropboxAuth();

export interface Track {
  title: string;
  src: string;
  duration: string;
}

const getFileName = (path: string): string => {
  const parts = path.split('/');
  let fileName = parts[parts.length - 1];
  // Remove the extension for a cleaner title
  fileName = fileName.replace(/\.[^/.]+$/, "");
  return fileName;
}

const getAudioDuration = (src: string): Promise<string> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      if (isNaN(duration)) {
        resolve('--:--');
        return;
      }
      
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    audio.onerror = () => {
      resolve('--:--');
    };
    
    audio.src = src;
  });
}

export const getDropboxAudioFiles = async (folderPath: string): Promise<Track[]> => {
  try {
    await dropboxAuth.ensureValidToken();
    const dbx = dropboxAuth.getDropboxInstance();
    
    if (import.meta.env.DEV) {
      console.log('Attempting to list folder:', folderPath || '(root/app folder)');
    }
    
    const pathToUse = folderPath === '' ? '' : folderPath;
    
    const response = await dbx.filesListFolder({ 
      path: pathToUse, 
      recursive: false 
    });
    
    if (import.meta.env.DEV) {
      console.log('Dropbox API response:', response.result);
    }
    
    const audioFileEntries = response.result.entries.filter(
      (entry: any) => entry['.tag'] === 'file' && /\.(mp3|wav|flac|m4a)$/i.test(entry.name)
    );

    if (import.meta.env.DEV) {
      console.log(`Found ${audioFileEntries.length} audio files:`, audioFileEntries.map((f: any) => f.name));
    }

    const trackPromises = audioFileEntries.map(async (file: any) => {
      if (!file.path_lower) {
        return null;
      }
      try {
        const tempLinkResult = await dbx.filesGetTemporaryLink({ path: file.path_lower });
        const src = tempLinkResult.result.link;
        const duration = await getAudioDuration(src);
        
        return {
          title: getFileName(file.name),
          src,
          duration,
        };
      } catch (linkError) {
        if (import.meta.env.DEV) {
          console.error(`Error getting link for ${file.name}:`, linkError);
        }
        return null;
      }
    });

    const tracks = (await Promise.all(trackPromises))
      .filter((track): track is Track => track !== null);
    
    return tracks;
  } catch (error: unknown) {
    const errorObj = error as { status?: number; message?: string; response?: unknown; error?: { error_summary?: string } };
    
    if (import.meta.env.DEV) {
      console.error("Error fetching files from Dropbox:", error);
      console.error("Error details:", {
        status: errorObj?.status,
        message: errorObj?.message,
        response: errorObj?.response,
        error_summary: errorObj?.error?.error_summary
      });
    }
    
    // Handle no authentication token case
    if (errorObj?.message === 'No authentication token available' || errorObj?.message === 'Authentication token is invalid') {
      console.log('No valid authentication token, redirecting to login...');
      dropboxAuth.redirectToAuth();
      throw new Error("Redirecting to Dropbox login...");
    }
    
    if (errorObj && errorObj.status === 401) {
      try {
        await dropboxAuth.refreshAccessToken();
        return await getDropboxAudioFiles(folderPath);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        dropboxAuth.redirectToAuth();
        throw new Error("Authentication expired. Redirecting to Dropbox login...");
      }
    }
    if (errorObj && errorObj.status === 409) {
      throw new Error(`Dropbox path conflict. The path "${folderPath}" might be incorrect or not a folder. For App Folder access, use an empty string "" to access the root.`);
    }
    if (errorObj && errorObj.status === 403) {
      throw new Error("Access forbidden. Make sure your Dropbox app has the correct permissions and the folder exists.");
    }
    throw new Error(`Could not fetch tracks from Dropbox: ${errorObj?.message || 'Unknown error'}`);
  }
};

export { dropboxAuth }; 