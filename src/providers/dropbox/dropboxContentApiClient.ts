import type { DropboxAuthAdapter } from './dropboxAuthAdapter';

/**
 * Executes a content-API (or any Dropbox-facing) request with one automatic
 * token refresh on 401.  A second consecutive 401 calls reportUnauthorized and
 * returns null, signalling the caller to abort.
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
