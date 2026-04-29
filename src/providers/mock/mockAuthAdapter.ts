import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';

export class MockAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    this.providerId = providerId;
  }

  isAuthenticated(): boolean {
    return true;
  }

  getAccessToken(): Promise<string | null> {
    return Promise.resolve('mock-access-token');
  }

  beginLogin(): Promise<void> {
    return Promise.resolve();
  }

  handleCallback(url: URL): Promise<boolean> {
    return Promise.resolve(url.href.length >= 0);
  }

  logout(): void {
    // no-op
  }
}
