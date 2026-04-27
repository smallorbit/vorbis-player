import type { DropboxFileEntry, DropboxListFolderResult, CachedLink } from './dropboxCatalogHelpers';
import { TEMP_LINK_TTL_MS } from './dropboxCatalogHelpers';
import type { DropboxAuthAdapter } from './dropboxAuthAdapter';

const DEFAULT_RETRY_AFTER_SECONDS = 5;
const MAX_RETRY_AFTER_SECONDS = 30;

async function parseRetryAfterSeconds(response: Response): Promise<number> {
  const header = response.headers.get('retry-after');
  if (header) {
    const parsed = Number.parseInt(header, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  try {
    const body = await response.clone().json() as { retry_after?: number };
    if (typeof body?.retry_after === 'number' && body.retry_after > 0) return body.retry_after;
  } catch {
    // 429 body wasn't JSON; fall through to default.
  }
  return DEFAULT_RETRY_AFTER_SECONDS;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export class DropboxApiClient {
  private auth: DropboxAuthAdapter;
  private tempLinkCache = new Map<string, CachedLink>();

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
  }

  async dropboxApi<T>(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    let token = await this.auth.ensureValidToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    const makeRequest = (accessToken: string) =>
      fetch(`https://api.dropboxapi.com/2${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });

    let response = await makeRequest(token);

    if (response.status === 401) {
      token = await this.auth.refreshAccessToken();
      if (!token) throw new Error('Dropbox authentication expired');
      response = await makeRequest(token);
      if (response.status === 401) {
        this.auth.reportUnauthorized();
        throw new Error('Dropbox authentication expired');
      }
    }

    if (response.status === 429) {
      const retryAfter = await parseRetryAfterSeconds(response);
      const waitMs = Math.min(Math.max(retryAfter, 1), MAX_RETRY_AFTER_SECONDS) * 1000;
      await sleep(waitMs, signal);
      response = await makeRequest(token);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async paginateFolder(
    path: string,
    callback: (entries: DropboxFileEntry[]) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    let result = await this.dropboxApi<DropboxListFolderResult>(
      '/files/list_folder',
      { path, recursive: true },
      signal,
    );
    callback(result.entries);
    while (result.has_more) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder/continue',
        { cursor: result.cursor },
        signal,
      );
      callback(result.entries);
    }
  }

  async getTemporaryLink(path: string): Promise<string> {
    const cached = this.tempLinkCache.get(path);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    const result = await this.dropboxApi<{ link: string }>(
      '/files/get_temporary_link',
      { path },
    );

    this.tempLinkCache.set(path, {
      url: result.link,
      expiresAt: Date.now() + TEMP_LINK_TTL_MS,
    });
    return result.link;
  }

  prefetchTemporaryLink(path: string): void {
    const cached = this.tempLinkCache.get(path);
    if (cached && Date.now() < cached.expiresAt) return;
    this.getTemporaryLink(path).catch(() => {});
  }
}
