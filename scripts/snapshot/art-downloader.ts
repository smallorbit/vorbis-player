import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ArtDownloader {
  /**
   * Returns the web-root-relative URL for the given image.
   * Idempotent: same originalUrl → same local filename → no re-download if file exists.
   */
  download(originalUrl: string, signal?: AbortSignal): Promise<string>;
}

function extFromContentType(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

export function createArtDownloader(targetDir: string, seed: string): ArtDownloader {
  mkdirSync(targetDir, { recursive: true });

  return {
    async download(originalUrl: string, signal?: AbortSignal): Promise<string> {
      const hash = createHash('sha1')
        .update(seed + ':' + originalUrl)
        .digest('hex')
        .slice(0, 16);

      // Probe existing files — check for any extension variant.
      for (const ext of ['jpg', 'png', 'webp', 'gif']) {
        const candidate = join(targetDir, `${hash}.${ext}`);
        if (existsSync(candidate)) {
          return `/playwright-fixtures/art/${hash}.${ext}`;
        }
      }

      const response = await fetch(originalUrl, { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch art ${originalUrl}: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const ext = extFromContentType(contentType);
      const filename = `${hash}.${ext}`;
      const destPath = join(targetDir, filename);

      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(destPath, buffer);

      return `/playwright-fixtures/art/${filename}`;
    },
  };
}
