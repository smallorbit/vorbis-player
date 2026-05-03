import type { DropboxAuthAdapter } from './dropboxAuthAdapter';

/**
 * Executes a Dropbox API request with one automatic token refresh on 401.
 *
 * Returns null (telling the caller to abort) in three distinct cases:
 *   1. `ensureValidToken()` returns null — initial auth missing; `requestFn` is never invoked.
 *   2. Initial 401 + `refreshAccessToken()` returns null — refresh failed; `reportUnauthorized` is **not** called
 *      (a failed refresh is treated the same as a missing initial token).
 *   3. Initial 401, refresh succeeds, retry returns 401 — `reportUnauthorized()` is invoked before returning null.
 *
 * Any non-401 response (including other 4xx/5xx, 409 path errors, 429 rate limits) is
 * returned as-is for the caller to handle. Used for both `content.dropboxapi.com`
 * uploads/downloads and `api.dropboxapi.com` metadata calls.
 *
 * @param auth        - Auth adapter supplying and refreshing tokens.
 * @param requestFn   - Factory that receives an access token and returns a fetch Promise.
 * @returns The Response on any non-401 outcome, or null when auth is unrecoverable.
 */
export async function contentApiRequest(
  auth: DropboxAuthAdapter,
  requestFn: (token: string) => Promise<Response>,
): Promise<Response | null> {
  const token = await auth.ensureValidToken();
  if (!token) return null;

  let response = await requestFn(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return null;
    response = await requestFn(refreshed);
    if (response.status === 401) {
      auth.reportUnauthorized();
      return null;
    }
  }

  return response;
}
