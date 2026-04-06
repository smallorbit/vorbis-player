
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 0x100000000;
  };
}

function weightedPick(
  albums: { trackCount: number }[],
  rng: () => number,
  exclude: Set<number>,
): number {
  let totalWeight = 0;
  for (let i = 0; i < albums.length; i++) {
    if (!exclude.has(i)) totalWeight += albums[i].trackCount;
  }
  if (totalWeight === 0) return -1;

  let target = rng() * totalWeight;
  for (let i = 0; i < albums.length; i++) {
    if (exclude.has(i)) continue;
    target -= albums[i].trackCount;
    if (target <= 0) return i;
  }
  return albums.length - 1;
}

interface AlbumEntry {
  key: string;
  trackCount: number;
}

export function selectMosaicCovers(
  tracksByAlbum: Map<string, { coverUrl: string; trackCount: number }>,
  playlistId: string,
): string[] {
  const albums: AlbumEntry[] = [];
  for (const [key, entry] of tracksByAlbum.entries()) {
    albums.push({ key, trackCount: entry.trackCount });
  }

  if (albums.length === 0) return [];
  if (albums.length === 1) return [albums[0].key];

  if (albums.length <= 3) {
    const sorted = [...albums].sort((a, b) => b.trackCount - a.trackCount);
    return [sorted[0].key, sorted[1].key];
  }

  const seed = hashString(playlistId);
  const rng = seededRandom(seed);
  const picked: string[] = [];
  const excluded = new Set<number>();

  for (let i = 0; i < 4 && excluded.size < albums.length; i++) {
    const idx = weightedPick(albums, rng, excluded);
    if (idx === -1) break;
    picked.push(albums[idx].key);
    excluded.add(idx);
  }

  return picked;
}

export function buildAlbumCoverMap(
  tracks: { album?: string; albumId?: string; image?: string }[],
): Map<string, { coverUrl: string; trackCount: number }> {
  const map = new Map<string, { coverUrl: string; trackCount: number }>();
  for (const track of tracks) {
    const key = track.albumId ?? track.album ?? '';
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.trackCount++;
      if (!existing.coverUrl && track.image) existing.coverUrl = track.image;
    } else {
      map.set(key, { coverUrl: track.image ?? '', trackCount: 1 });
    }
  }
  return map;
}
