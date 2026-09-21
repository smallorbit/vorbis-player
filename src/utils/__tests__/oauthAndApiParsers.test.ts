import { describe, expect, it } from 'vitest';

import { parseAuthCompletePostMessage } from '@/utils/authPostMessage';
import { parseOAuthTokenResponse } from '@/utils/oauthTokenResponse';
import { parseSpotifyApiErrorBody } from '@/utils/spotifyApiErrorBody';
import { AUTH_COMPLETE_EVENT } from '@/constants/events';

describe('parseOAuthTokenResponse', () => {
  it('parses access_token and optional fields', () => {
    expect(
      parseOAuthTokenResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
      }),
    ).toEqual({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 });
  });

  it('rejects missing access_token', () => {
    expect(() => parseOAuthTokenResponse({})).toThrow(/access_token/);
  });
});

describe('parseAuthCompletePostMessage', () => {
  it('accepts spotify provider payloads', () => {
    expect(
      parseAuthCompletePostMessage({ type: AUTH_COMPLETE_EVENT, provider: 'spotify' }),
    ).toEqual({ type: AUTH_COMPLETE_EVENT, provider: 'spotify' });
  });

  it('returns null for unrelated messages', () => {
    expect(parseAuthCompletePostMessage({ type: 'other' })).toBeNull();
  });
});

describe('parseSpotifyApiErrorBody', () => {
  it('extracts nested error message', () => {
    expect(
      parseSpotifyApiErrorBody(JSON.stringify({ error: { message: 'nope', reason: 'x' } })),
    ).toEqual({ message: 'nope', reason: 'x' });
  });

  it('returns null for invalid JSON', () => {
    expect(parseSpotifyApiErrorBody('not json')).toBeNull();
  });
});
