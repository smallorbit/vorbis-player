/**
 * Apple Music AuthProvider adapter.
 * Uses MusicKit JS popup-based auth (no redirect callbacks).
 */

import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import { appleMusicService } from './appleMusicService';

export class AppleMusicAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId = 'apple-music';

  isAuthenticated(): boolean {
    return appleMusicService.isAuthorized();
  }

  async getAccessToken(): Promise<string | null> {
    const instance = appleMusicService.getInstance();
    return instance?.musicUserToken || null;
  }

  async beginLogin(): Promise<void> {
    const instance = await appleMusicService.ensureLoaded();
    const token = await instance.authorize();
    appleMusicService.persistToken(token);
  }

  /**
   * MusicKit JS uses popup auth, not redirect callbacks.
   * Always returns false since there is no callback URL to handle.
   */
  async handleCallback(_url: URL): Promise<boolean> {
    return false;
  }

  logout(): void {
    const instance = appleMusicService.getInstance();
    if (instance) {
      instance.unauthorize();
    }
    appleMusicService.clearToken();
  }
}
