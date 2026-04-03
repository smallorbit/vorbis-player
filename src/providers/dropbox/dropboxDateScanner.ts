import type { MediaCollection } from '@/types/domain';
import type { DropboxApiClient } from './dropboxApiClient';
import { getTrackDatesMap, putTrackDate } from './dropboxArtCache';
import { parseID3 } from '@/utils/id3Parser';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

export async function scanAlbumDatesInBackground(
  apiClient: DropboxApiClient,
  albums: MediaCollection[],
  audioByDir: Map<string, string>,
): Promise<void> {
  const albumIds = albums.filter((a) => a.kind === 'album' && a.id).map((a) => a.id);
  const existing = await getTrackDatesMap(albumIds);
  const toScan = albums.filter((a) => a.kind === 'album' && a.id && !existing.has(a.id));
  if (toScan.length === 0) return;

  for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
    const batch = toScan.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (album) => {
        const trackPath = audioByDir.get(album.id);
        if (!trackPath) return;
        try {
          const tempUrl = await apiClient.getTemporaryLink(trackPath);
          const resp = await fetch(tempUrl, {
            headers: { Range: 'bytes=0-10240' },
          });
          if (!resp.ok) return;
          const buffer = await resp.arrayBuffer();
          const meta = parseID3(buffer);
          if (meta.releaseYear) {
            await putTrackDate(album.id, meta.releaseYear);
            album.releaseDate = String(meta.releaseYear);
          }
        } catch {
          // Silently skip -- will retry on next catalog refresh
        }
      }),
    );
    if (i + BATCH_SIZE < toScan.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}
