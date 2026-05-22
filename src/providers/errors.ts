import type { ProviderId } from '@/types/domain';

export class AuthExpiredError extends Error {
  readonly providerId: ProviderId;
  constructor(providerId: ProviderId) {
    super(`Auth expired for provider: ${providerId}`);
    this.name = 'AuthExpiredError';
    this.providerId = providerId;
  }
}

export class UnavailableTrackError extends Error {
  readonly trackName: string;
  constructor(trackName: string) {
    super(`Track unavailable: ${trackName}`);
    this.name = 'UnavailableTrackError';
    this.trackName = trackName;
  }
}

export type RequiredProviderAdapter = 'auth' | 'catalog' | 'playback';

export class InvalidProviderDescriptorError extends Error {
  readonly providerId: string;
  readonly missingAdapter: RequiredProviderAdapter;
  constructor(providerId: string, missingAdapter: RequiredProviderAdapter) {
    super(`Provider '${providerId}' is missing required adapter: ${missingAdapter}`);
    this.name = 'InvalidProviderDescriptorError';
    this.providerId = providerId;
    this.missingAdapter = missingAdapter;
  }
}
