const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read'
];

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

class SpotifyAuth {
  private tokenData: TokenData | null = null;

  constructor() {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage() {
    const stored = localStorage.getItem('spotify_token');
    if (stored) {
      try {
        const tokenData = JSON.parse(stored);
        if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
          localStorage.removeItem('spotify_token');
          return;
        }
        this.tokenData = tokenData;
      } catch {
        localStorage.removeItem('spotify_token');
      }
    }
  }

  private saveTokenToStorage(tokenData: TokenData) {
    this.tokenData = tokenData;
    localStorage.setItem('spotify_token', JSON.stringify(tokenData));
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
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined. Please set it in your .env.local file.');
    }

    const code_verifier = this.generateCodeVerifier();
    const code_challenge = await this.generateCodeChallenge(code_verifier);
    
    localStorage.setItem('spotify_code_verifier', code_verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: code_challenge,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  public async handleAuthCallback(code: string): Promise<void> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const code_verifier = localStorage.getItem('spotify_code_verifier');
    if (!code_verifier) {
      throw new Error('Code verifier not found. Please restart the authentication flow.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
    localStorage.removeItem('spotify_code_verifier');
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenData.refresh_token,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokenData.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
  }

  public async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('No authentication token available');
    }

    if (Date.now() > this.tokenData.expires_at - 300000) {
      await this.refreshAccessToken();
    }

    return this.tokenData.access_token;
  }

  public isAuthenticated(): boolean {
    return !!this.tokenData?.access_token;
  }

  public async redirectToAuth(): Promise<void> {
    const authUrl = await this.getAuthUrl();
    window.location.href = authUrl;
  }

  public logout(): void {
    this.tokenData = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_code_verifier');
  }

  public async handleRedirect(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      this.logout();
      throw new Error(`Spotify auth error: ${error}`);
    }

    if (code && window.location.pathname === '/auth/spotify/callback') {
      const processedCode = sessionStorage.getItem('spotify_processed_code');
      if (processedCode === code) {
        window.history.replaceState({}, document.title, '/');
        return;
      }

      try {
        await this.handleAuthCallback(code);
        sessionStorage.setItem('spotify_processed_code', code);
        window.history.replaceState({}, document.title, '/');
      } catch (e) {
        sessionStorage.removeItem('spotify_processed_code');
        this.logout();
        throw e;
      }
    }
  }

  public getAccessToken(): string | null {
    return this.tokenData?.access_token || null;
  }
}

export const spotifyAuth = new SpotifyAuth();

export interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  duration_ms: number;
  uri: string;
  preview_url?: string;
  image?: string;
}

export const getSpotifyUserPlaylists = async (): Promise<Track[]> => {
  try {
    const token = await spotifyAuth.ensureValidToken();
    console.log('✓ Token obtained successfully');
    
    console.log('Fetching user playlists...');
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Playlist fetch error:', response.status, errorText);
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✓ Found ${data.items?.length || 0} playlists:`, data.items?.map((p: { name: string }) => p.name));
    
    if (!data.items || data.items.length === 0) {
      console.warn('No playlists found in user account');
      return [];
    }
    
    const tracks: Track[] = [];
    
    // Get tracks from user's playlists (limit to first 10 playlists to avoid rate limits)
    for (const playlist of (data.items || []).slice(0, 10)) {
      if (!playlist.tracks?.href) {
        console.warn(`Playlist ${playlist.name} has no tracks href`);
        continue;
      }
      
      console.log(`Fetching tracks from playlist: "${playlist.name}" (${playlist.tracks.total} tracks)`);
      const tracksResponse = await fetch(playlist.tracks.href + '?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        console.log(`✓ Found ${tracksData.items?.length || 0} track items in "${playlist.name}"`);
        
        let validTracksInPlaylist = 0;
        for (const item of (tracksData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            tracks.push({
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            });
            validTracksInPlaylist++;
          } else {
            console.debug(`Skipped item in "${playlist.name}":`, {
              hasTrack: !!item.track,
              hasId: !!item.track?.id,
              isLocal: item.track?.is_local,
              type: item.track?.type
            });
          }
        }
        console.log(`✓ Added ${validTracksInPlaylist} valid tracks from "${playlist.name}"`);
      } else {
        const errorText = await tracksResponse.text();
        console.warn(`Failed to fetch tracks from playlist "${playlist.name}":`, tracksResponse.status, errorText);
      }
    }

    console.log(`✓ Total tracks collected from playlists: ${tracks.length}`);
    
    // If no tracks found in playlists, try to get liked songs
    if (tracks.length === 0) {
      console.log('No tracks found in playlists, trying liked songs...');
      
      const likedResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (likedResponse.ok) {
        const likedData = await likedResponse.json();
        console.log(`✓ Found ${likedData.items?.length || 0} liked songs`);
        
        for (const item of (likedData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            tracks.push({
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            });
          }
        }
        console.log(`✓ Added ${tracks.length} tracks from liked songs`);
      } else {
        console.warn('Failed to fetch liked songs:', likedResponse.status);
      }
    }
    
    if (tracks.length === 0) {
      console.warn('No valid tracks found anywhere. This could mean:');
      console.warn('- All playlists are empty');
      console.warn('- No liked songs');
      console.warn('- All tracks are local files (not supported)');
      console.warn('- User needs to add music to their Spotify account');
    }
    
    return tracks;
  } catch (error) {
    console.error('Error in getSpotifyUserPlaylists:', error);
    if (error instanceof Error && error.message === 'No authentication token available') {
      spotifyAuth.redirectToAuth();
      throw new Error('Redirecting to Spotify login...');
    }
    throw error;
  }
};