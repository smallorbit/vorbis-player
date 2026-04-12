import type { AlbumInfo } from '../spotify';
import {
  getPlaylistCount,
  getAlbumCount,
  getLikedSongsCount,
  getAllUserPlaylists,
  getAllUserAlbums,
  invalidateLikedSongsCaches,
} from '../spotify';
import * as cache from './libraryCache';
import type { CachedPlaylistInfo, LibraryChanges } from './cacheTypes';

export async function detectChanges(signal: AbortSignal): Promise<LibraryChanges> {
  const [playlistsMeta, albumsMeta, likedMeta] = await Promise.all([
    cache.getMeta('playlists'),
    cache.getMeta('albums'),
    cache.getMeta('likedSongs'),
  ]);

  const [newPlaylistCount, newAlbumCount, newLikedSongsCount] = await Promise.all([
    getPlaylistCount(signal),
    getAlbumCount(signal),
    getLikedSongsCount(signal),
  ]);

  const playlistsChanged = newPlaylistCount !== (playlistsMeta?.totalCount ?? -1);
  const albumsChanged = newAlbumCount !== (albumsMeta?.totalCount ?? -1);
  const likedSongsChanged = newLikedSongsCount !== (likedMeta?.totalCount ?? -1);

  return {
    playlistsChanged,
    albumsChanged,
    likedSongsChanged,
    changedPlaylistIds: [],
    newPlaylistCount,
    newAlbumCount,
    newLikedSongsCount,
  };
}

export async function applyChanges(
  changes: LibraryChanges,
  signal: AbortSignal,
  pendingRemovals: Map<string, number>,
  pendingAdditions: Map<string, number>,
): Promise<{ playlists: CachedPlaylistInfo[]; albums: AlbumInfo[]; likedSongsCount: number }> {
  let updatedPlaylists: CachedPlaylistInfo[] | undefined;
  let updatedAlbums: AlbumInfo[] | undefined;

  if (changes.playlistsChanged) {
    updatedPlaylists = await syncPlaylists(changes.newPlaylistCount, signal);
  }

  if (changes.albumsChanged) {
    updatedAlbums = await syncAlbums(signal, pendingRemovals, pendingAdditions);
  }

  if (changes.likedSongsChanged) {
    invalidateLikedSongsCaches();
    await cache.putMeta('likedSongs', {
      lastValidated: Date.now(),
      totalCount: changes.newLikedSongsCount,
    });
  }

  const playlists = updatedPlaylists ?? await cache.getAllPlaylists();
  const albums = updatedAlbums ?? await cache.getAllAlbums();

  return { playlists, albums, likedSongsCount: changes.newLikedSongsCount };
}

async function syncPlaylists(newTotal: number, signal: AbortSignal): Promise<CachedPlaylistInfo[]> {
  const [cachedPlaylists, meta] = await Promise.all([
    cache.getAllPlaylists(),
    cache.getMeta('playlists'),
  ]);

  const cachedMap = new Map<string, CachedPlaylistInfo>(
    cachedPlaylists.map(p => [p.id, p])
  );

  if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');

  const playlists = await getAllUserPlaylists(signal);
  const allFetched = playlists as CachedPlaylistInfo[];

  for (let i = 0; i < allFetched.length; i++) {
    const p = allFetched[i];
    const cached = cachedMap.get(p.id);
    p.added_at =
      cached?.added_at ||
      p.added_at ||
      new Date(Date.now() - i * 60000).toISOString();
  }

  const fetchedIds = new Set(allFetched.map(p => p.id));
  const snapshotIds: Record<string, string> = { ...(meta?.snapshotIds ?? {}) };

  const removals: Promise<void>[] = [];
  for (const cached of cachedPlaylists) {
    if (!fetchedIds.has(cached.id)) {
      removals.push(cache.removePlaylist(cached.id), cache.removeTrackList(`playlist:${cached.id}`));
      delete snapshotIds[cached.id];
    }
  }
  await Promise.all(removals);

  const writes: Promise<void>[] = [];
  for (const fetched of allFetched) {
    const cached = cachedMap.get(fetched.id);
    if (cached && fetched.snapshot_id && fetched.snapshot_id !== cached.snapshot_id) {
      writes.push(cache.removeTrackList(`playlist:${fetched.id}`));
    }
    writes.push(cache.putPlaylist(fetched));
    if (fetched.snapshot_id) {
      snapshotIds[fetched.id] = fetched.snapshot_id;
    }
  }
  await Promise.all(writes);

  await cache.putMeta('playlists', {
    lastValidated: Date.now(),
    totalCount: newTotal,
    snapshotIds,
  });

  return allFetched;
}

async function syncAlbums(
  signal: AbortSignal,
  pendingRemovals: Map<string, number>,
  pendingAdditions: Map<string, number>,
): Promise<AlbumInfo[]> {
  const cachedAlbums = await cache.getAllAlbums();

  const allFetched = await getAllUserAlbums(signal);

  const fetchedIds = new Set(allFetched.map(a => a.id));

  const ops: Promise<void>[] = [];
  for (const cached of cachedAlbums) {
    if (!fetchedIds.has(cached.id) && !pendingAdditions.has(cached.id)) {
      ops.push(cache.removeAlbum(cached.id), cache.removeTrackList(`album:${cached.id}`));
    }
  }
  for (const fetched of allFetched) {
    if (!pendingRemovals.has(fetched.id)) {
      ops.push(cache.putAlbum(fetched));
    }
  }
  await Promise.all(ops);

  const finalAlbums: AlbumInfo[] = [
    ...allFetched.filter(f => !pendingRemovals.has(f.id)),
    ...cachedAlbums.filter(a => pendingAdditions.has(a.id) && !fetchedIds.has(a.id)),
  ];
  const seen = new Set<string>();
  const deduped = finalAlbums.filter(a => seen.has(a.id) ? false : (seen.add(a.id), true));

  const latestAddedAt = deduped.reduce(
    (latest, a) => (a.added_at && a.added_at > latest ? a.added_at : latest),
    '',
  );
  await cache.putMeta('albums', {
    lastValidated: Date.now(),
    totalCount: deduped.length,
    latestAddedAt: latestAddedAt || undefined,
  });

  return deduped;
}
