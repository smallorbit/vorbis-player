import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';

export class MockAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId;
  private authenticated = true;

  constructor(providerId: ProviderId) {
    this.providerId = providerId;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getAccessToken(): Promise<string | null> {
    return Promise.resolve(this.authenticated ? 'mock-access-token' : null);
  }

  beginLogin(): Promise<void> {
    this.authenticated = true;
    return Promise.resolve();
  }

  handleCallback(url: URL): Promise<boolean> {
    void url;
    this.authenticated = true;
    return Promise.resolve(true);
  }

  logout(): void {
    this.authenticated = false;
  }

  /** Test-only: flip the adapter back into the authenticated state. */
  __testRestoreAuth(): void {
    this.authenticated = true;
  }

  /** Test-only: force the adapter into the expired/unauthenticated state. */
  __testExpire(): void {
    this.authenticated = false;
  }
}
