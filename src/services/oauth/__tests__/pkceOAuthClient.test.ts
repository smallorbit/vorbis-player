import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorageMock } from '@/test/storageMock';
import {
  OAuthStateMismatchError,
  PendingLoginMissingError,
  PkceOAuthClient,
  type RefreshOutcome,
} from '../pkceOAuthClient';

const localStorageMock = createStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

const VERIFIER_KEY = 'test-code-verifier';
const STATE_KEY = 'test-oauth-state';

function makeClient(): PkceOAuthClient<RefreshOutcome> {
  return new PkceOAuthClient<RefreshOutcome>({
    label: 'Test',
    authorizeUrl: 'https://auth.example.com/authorize',
    tokenUrl: 'https://auth.example.com/token',
    getClientId: () => 'client-1',
    getRedirectUri: () => 'http://127.0.0.1:3000/callback',
    storageKeys: { codeVerifier: VERIFIER_KEY, state: STATE_KEY },
    authorizeParams: { scope: 'read' },
  });
}

function stubFetch(response: Partial<Response> | Error) {
  const fetchMock =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function tokenResponse(body: Record<string, unknown>): Partial<Response> {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  localStorageMock.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('PkceOAuthClient', () => {
  describe('buildAuthorizeUrl', () => {
    it('stores a verifier and a state and puts the state and S256 challenge in the URL', async () => {
      // #given
      const client = makeClient();

      // #when
      const url = new URL(await client.buildAuthorizeUrl());

      // #then
      const verifier = localStorageMock.getItem(VERIFIER_KEY);
      const state = localStorageMock.getItem(STATE_KEY);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(url.searchParams.get('state')).toBe(state);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(url.searchParams.get('scope')).toBe('read');
      expect(url.searchParams.get('client_id')).toBe('client-1');
    });

    it('issues a different state on every login attempt', async () => {
      // #given
      const client = makeClient();

      // #when
      await client.buildAuthorizeUrl();
      const first = localStorageMock.getItem(STATE_KEY);
      await client.buildAuthorizeUrl();
      const second = localStorageMock.getItem(STATE_KEY);

      // #then
      expect(first).not.toBe(second);
    });
  });

  describe('exchangeCode', () => {
    it('exchanges the code with the stored verifier and clears both pending keys', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const state = localStorageMock.getItem(STATE_KEY);
      const verifier = localStorageMock.getItem(VERIFIER_KEY);
      const fetchMock = stubFetch(tokenResponse({ access_token: 'tok', refresh_token: 'ref' }));

      // #when
      const token = await client.exchangeCode('the-code', state);

      // #then
      expect(token).toEqual({ access_token: 'tok', refresh_token: 'ref' });
      const body: unknown = fetchMock.mock.calls[0]?.[1]?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      if (!(body instanceof URLSearchParams)) return;
      expect(body.get('code_verifier')).toBe(verifier);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(localStorageMock.getItem(STATE_KEY)).toBeNull();
      expect(localStorageMock.getItem(VERIFIER_KEY)).toBeNull();
    });

    it('shares one exchange between concurrent callbacks for the same code', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const state = localStorageMock.getItem(STATE_KEY);
      const fetchMock = stubFetch(tokenResponse({ access_token: 'tok' }));

      // #when
      const [first, second] = await Promise.all([
        client.exchangeCode('the-code', state),
        client.exchangeCode('the-code', state),
      ]);

      // #then
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ access_token: 'tok' });
      expect(second).toEqual({ access_token: 'tok' });
    });

    it('rejects a mismatched state and consumes the stored one', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const fetchMock = stubFetch(tokenResponse({ access_token: 'tok' }));

      // #when / #then
      await expect(client.exchangeCode('the-code', 'forged')).rejects.toBeInstanceOf(
        OAuthStateMismatchError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(localStorageMock.getItem(STATE_KEY)).toBeNull();
    });

    it('refuses a replayed callback after the state was consumed', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const state = localStorageMock.getItem(STATE_KEY);
      stubFetch(tokenResponse({ access_token: 'tok' }));
      await client.exchangeCode('the-code', state);

      // #when / #then
      await expect(client.exchangeCode('the-code', state)).rejects.toBeInstanceOf(
        PendingLoginMissingError,
      );
    });

    it('throws PendingLoginMissingError when no state was stored', async () => {
      // #given
      const client = makeClient();
      const fetchMock = stubFetch(tokenResponse({ access_token: 'tok' }));

      // #when / #then
      await expect(client.exchangeCode('the-code', 'any-state')).rejects.toBeInstanceOf(
        PendingLoginMissingError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws PendingLoginMissingError when the verifier is gone', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const state = localStorageMock.getItem(STATE_KEY);
      localStorageMock.removeItem(VERIFIER_KEY);

      // #when / #then
      await expect(client.exchangeCode('the-code', state)).rejects.toBeInstanceOf(
        PendingLoginMissingError,
      );
    });

    it('keeps the verifier when the token endpoint fails', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();
      const state = localStorageMock.getItem(STATE_KEY);
      stubFetch({ ok: false, status: 400, text: async () => 'invalid_grant' });

      // #when / #then
      await expect(client.exchangeCode('the-code', state)).rejects.toThrow(
        'Test token exchange failed: 400 invalid_grant',
      );
      expect(localStorageMock.getItem(VERIFIER_KEY)).not.toBeNull();
    });
  });

  describe('refresh', () => {
    const passThrough = (outcome: RefreshOutcome): RefreshOutcome => outcome;

    it.each([400, 401])('classifies HTTP %i as terminal', async (status) => {
      // #given
      stubFetch({ ok: false, status });

      // #when
      const outcome = await makeClient().refresh('ref', passThrough);

      // #then
      expect(outcome).toEqual({ kind: 'terminal', status });
    });

    it.each([429, 500, 503])('classifies HTTP %i as transient', async (status) => {
      // #given
      stubFetch({ ok: false, status });

      // #when
      const outcome = await makeClient().refresh('ref', passThrough);

      // #then
      expect(outcome).toEqual({ kind: 'transient', status });
    });

    it('classifies a network failure as transient', async () => {
      // #given
      const networkError = new TypeError('Failed to fetch');
      stubFetch(networkError);

      // #when
      const outcome = await makeClient().refresh('ref', passThrough);

      // #then
      expect(outcome).toEqual({ kind: 'transient', status: null, error: networkError });
    });

    it('shares one request and one apply across concurrent callers', async () => {
      // #given
      const client = makeClient();
      const fetchMock = stubFetch(tokenResponse({ access_token: 'fresh', expires_in: 3600 }));
      const apply = vi.fn(passThrough);

      // #when
      const results = await Promise.all([
        client.refresh('ref', apply),
        client.refresh('ref', apply),
        client.refresh('ref', apply),
      ]);

      // #then
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledTimes(1);
      for (const result of results) {
        expect(result).toEqual({
          kind: 'success',
          token: { access_token: 'fresh', expires_in: 3600 },
        });
      }
    });

    it('starts a new request once the previous flight settles', async () => {
      // #given
      const client = makeClient();
      const fetchMock = stubFetch(tokenResponse({ access_token: 'fresh' }));

      // #when
      await client.refresh('ref', passThrough);
      await client.refresh('ref', passThrough);

      // #then
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearPendingLogin', () => {
    it('removes the verifier and the state', async () => {
      // #given
      const client = makeClient();
      await client.buildAuthorizeUrl();

      // #when
      client.clearPendingLogin();

      // #then
      expect(localStorageMock.getItem(VERIFIER_KEY)).toBeNull();
      expect(localStorageMock.getItem(STATE_KEY)).toBeNull();
    });
  });
});
