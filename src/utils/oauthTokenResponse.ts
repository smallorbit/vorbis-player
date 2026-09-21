/** Dropbox / Spotify OAuth token endpoint JSON (subset we persist). */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string | undefined;
  expires_in?: number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseOAuthTokenResponse(value: unknown): OAuthTokenResponse {
  if (!isRecord(value)) {
    throw new Error('Invalid OAuth token response');
  }
  const accessToken = value['access_token'];
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Invalid OAuth token response: missing access_token');
  }
  const parsed: OAuthTokenResponse = { access_token: accessToken };
  const refreshToken = value['refresh_token'];
  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    parsed.refresh_token = refreshToken;
  }
  const expiresIn = value['expires_in'];
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    parsed.expires_in = expiresIn;
  }
  return parsed;
}
