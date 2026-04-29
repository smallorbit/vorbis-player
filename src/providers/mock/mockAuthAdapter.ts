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
    void url;
    return Promise.resolve(true);
  }

  logout(): void {
    // no-op
  }
}
