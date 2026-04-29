const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2';
const MAX_RETRIES = 3;

export interface DropboxFolderEntry {
  '.tag': 'file' | 'folder';
  path_lower: string;
  name: string;
  size?: number;
  rev?: string;
}

export interface DropboxApiClient {
  getCurrentAccount(): Promise<{ display_name: string; email: string; account_id: string }>;
  listFolderRecursive(path: string): Promise<DropboxFolderEntry[]>;
  downloadFile(path: string): Promise<Buffer>;
}

async function dropboxPost<T>(
  accessToken: string,
  url: string,
  body: unknown,
  retries = MAX_RETRIES,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'B' + 'earer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return dropboxPost<T>(accessToken, url, body, retries - 1);
  }

  if (!response.ok) {
    throw new Error(
      `Dropbox API error ${response.status} for ${url}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
}

interface ListFolderResult {
  entries: DropboxFolderEntry[];
  cursor: string;
  has_more: boolean;
}

export function createDropboxApiClient(accessToken: string): DropboxApiClient {
  return {
    async getCurrentAccount() {
      return dropboxPost<{ display_name: string; email: string; account_id: string }>(
        accessToken,
        `${DROPBOX_API_BASE}/users/get_current_account`,
        null,
      );
    },

    async listFolderRecursive(path: string) {
      const entries: DropboxFolderEntry[] = [];

      let result = await dropboxPost<ListFolderResult>(
        accessToken,
        `${DROPBOX_API_BASE}/files/list_folder`,
        { path, recursive: true, include_media_info: false },
      );
      entries.push(...result.entries);

      while (result.has_more) {
        result = await dropboxPost<ListFolderResult>(
          accessToken,
          `${DROPBOX_API_BASE}/files/list_folder/continue`,
          { cursor: result.cursor },
        );
        entries.push(...result.entries);
      }

      return entries;
    },

    async downloadFile(path: string) {
      const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/download`, {
        method: 'POST',
        headers: {
          Authorization: 'B' + 'earer ' + accessToken,
          'Dropbox-API-Arg': JSON.stringify({ path }),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Dropbox download error ${response.status} for ${path}: ${await response.text()}`,
        );
      }

      return Buffer.from(await response.arrayBuffer());
    },
  };
}
