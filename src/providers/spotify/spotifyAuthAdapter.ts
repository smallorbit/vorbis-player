/**
 * Spotify AuthProvider adapter.
 * Delegates to the existing spotifyAuth singleton.
 */

import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import { spotifyAuth } from '@/services/spotify';

export class SpotifyAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId = 'spotify';

  isAuthenticated(): boolean {
    return spotifyAuth.isAuthenticated();
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await spotifyAuth.ensureValidToken();
    } catch {
      return spotifyAuth.getAccessToken();
    }
  }

  async beginLogin(options?: { popup?: boolean }): Promise<void> {
    if (options?.popup) {
      const url = await spotifyAuth.getAuthUrl();
      const win = window.open(url, '_blank');
      if (!win) {
        window.location.href = url;
      }
      return;
    }
    await spotifyAuth.redirectToAuth();
  }

  async handleCallback(url: URL): Promise<boolean> {
    if (url.pathname !== '/auth/spotify/callback') {
      return false;
    }

    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      spotifyAuth.logout();
      throw new Error(`Spotify auth error: ${error}`);
    }

    if (!code) {
      return false;
    }

    await spotifyAuth.handleRedirect();
    return true;
  }

  logout(): void {
    spotifyAuth.logout();
  }
}
