import type { DropboxFileEntry, DropboxListFolderResult, CachedLink } from './dropboxCatalogHelpers';
import { TEMP_LINK_TTL_MS } from './dropboxCatalogHelpers';
import type { DropboxAuthAdapter } from './dropboxAuthAdapter';

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
