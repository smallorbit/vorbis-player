export class AuthExpiredError extends Error {
  readonly providerId: string;
  constructor(providerId: string) {
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
