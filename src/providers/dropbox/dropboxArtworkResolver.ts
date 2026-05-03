import type { DropboxFileEntry } from './dropboxCatalogHelpers';
import { pickAlbumArtPath, isImageFile } from './dropboxCatalogHelpers';
import type { DropboxApiClient } from './dropboxApiClient';
import {
  getArt,
  putArt,
  clearArt,
  getAlbumArt,
  putAlbumArt,
} from './dropboxArtCache';
import { bytesToDataUrl } from '@/utils/bytesToDataUrl';

export class DropboxArtworkResolver {
  private apiClient: DropboxApiClient;
  private pendingArtFetches = new Map<string, Promise<string | null>>();

  constructor(apiClient: DropboxApiClient) {
    this.apiClient = apiClient;
  }

  fetchArtDataUrl(path: string): Promise<string | null> {
    const pending = this.pendingArtFetches.get(path);
    if (pending) return pending;

    const promise = this.doFetchArtDataUrl(path).finally(() => {
      this.pendingArtFetches.delete(path);
    });
    this.pendingArtFetches.set(path, promise);
    return promise;
  }

  private async doFetchArtDataUrl(path: string): Promise<string | null> {
    const cached = await getArt(path);
    if (cached) return cached;

    try {
      const tempUrl = await this.apiClient.getTemporaryLink(path);
      const resp = await fetch(tempUrl);
      if (!resp.ok) return null;

      const mimeType = resp.headers.get('Content-Type') ?? 'image/jpeg';
      const buffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const dataUrl = bytesToDataUrl(bytes, mimeType);

      await putArt(path, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }

  async clearArtCache(): Promise<void> {
    await clearArt();
  }

  async getAlbumArtForAlbum(albumPath: string): Promise<string | null> {
    return getAlbumArt(albumPath);
  }

  async cacheAlbumArtForAlbum(albumPath: string, dataUrl: string): Promise<void> {
    await putAlbumArt(albumPath, dataUrl);
  }

  async resolveAlbumArtByDir(
    imagesByDir: Map<string, DropboxFileEntry[]>,
    albumDirs: Iterable<string>,
  ): Promise<Map<string, string>> {
    const dirToImageUrl = new Map<string, string>();
    const uniqueDirs = Array.from(new Set(albumDirs));

    await Promise.all(
      uniqueDirs.map(async (dir) => {
        const entries = imagesByDir.get(dir) ?? [];
        const imagePath = pickAlbumArtPath(entries);
        if (imagePath) {
          const imageUrl = await this.fetchArtDataUrl(imagePath);
          if (imageUrl) {
            dirToImageUrl.set(dir, imageUrl);
            // Dual-key cache: fetchArtDataUrl already stored under the file path (fast
            // per-track lookup); this second write keys on the directory so album-level
            // lookups (resolveAlbumArt, getAlbumArtForAlbum) can hit without re-scanning.
            await putAlbumArt(dir, imageUrl);
            return;
          }
        }

        const cachedAlbumArt = await getAlbumArt(dir);
        if (cachedAlbumArt) {
          dirToImageUrl.set(dir, cachedAlbumArt);
        }
      }),
    );

    return dirToImageUrl;
  }

  async resolveAlbumArt(albumDir: string, signal?: AbortSignal): Promise<string | null> {
    if (!albumDir) return null;

    const cached = await getAlbumArt(albumDir);
    if (cached) return cached;

    try {
      const result = await this.apiClient.dropboxApi<{ entries: DropboxFileEntry[] }>(
        '/files/list_folder',
        { path: albumDir, recursive: false },
        signal,
      );

      const images = result.entries.filter(
        (e) => e['.tag'] === 'file' && isImageFile(e.name),
      );
      const imagePath = pickAlbumArtPath(images);
      if (!imagePath) return null;

      const imageUrl = await this.fetchArtDataUrl(imagePath);
      if (imageUrl) {
        await putAlbumArt(albumDir, imageUrl);
      }
      return imageUrl;
    } catch {
      return null;
    }
  }
}
