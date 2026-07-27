import type { MediaCollection } from '@/types/domain';
import {
  getPlaylistCount,
  getAlbumCount,
  getLikedSongsCount,
  getAllUserPlaylists,
  getAllUserAlbums,
  invalidateLikedSongsCaches,
} from '../spotify';
import * as cache from './libraryCache';
import type { LibraryChanges } from './cacheTypes';

const ENGINE_PROVIDER = 'spotify' as const;

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
): Promise<{ playlists: MediaCollection[]; albums: MediaCollection[]; likedSongsCount: number }> {
  let updatedPlaylists: MediaCollection[] | undefined;
  let updatedAlbums: MediaCollection[] | undefined;

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

  // The cache holds all providers' collections; the engine owns only its own.
  const playlists = updatedPlaylists
    ?? (await cache.getAllPlaylists()).filter((p) => p.provider === ENGINE_PROVIDER);
  const albums = updatedAlbums
    ?? (await cache.getAllAlbums()).filter((a) => a.provider === ENGINE_PROVIDER);

  return { playlists, albums, likedSongsCount: changes.newLikedSongsCount };
}

async function syncPlaylists(newTotal: number, signal: AbortSignal): Promise<MediaCollection[]> {
  const [cachedPlaylists, meta] = await Promise.all([
    cache.getAllPlaylists(),
    cache.getMeta('playlists'),
  ]);

  const cachedMap = new Map<string, MediaCollection>(
    cachedPlaylists
      .filter((p) => p.provider === ENGINE_PROVIDER)
      .map((p) => [p.id, p]),
  );

  if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');

  const allFetched = await getAllUserPlaylists(signal);

  const fetchedIds = new Set(allFetched.map((p) => p.id));
  const revisions: Record<string, string> = { ...(meta?.revisions ?? {}) };

  const removals: Promise<void>[] = [];
  for (const cached of cachedMap.values()) {
    if (!fetchedIds.has(cached.id)) {
      removals.push(
        cache.removePlaylist(ENGINE_PROVIDER, cached.id),
        cache.removeTrackList({ provider: ENGINE_PROVIDER, kind: 'playlist', id: cached.id }),
      );
      delete revisions[cached.id];
    }
  }
  await Promise.all(removals);

  const writes: Promise<void>[] = [];
  for (const fetched of allFetched) {
    const cached = cachedMap.get(fetched.id);
    if (cached && fetched.revision && fetched.revision !== cached.revision) {
      writes.push(cache.removeTrackList({ provider: ENGINE_PROVIDER, kind: 'playlist', id: fetched.id }));
    }
    writes.push(cache.putPlaylist(fetched));
    if (fetched.revision) {
      revisions[fetched.id] = fetched.revision;
    }
  }
  await Promise.all(writes);

  await cache.putMeta('playlists', {
    lastValidated: Date.now(),
    totalCount: newTotal,
    revisions,
  });

  return allFetched;
}

async function syncAlbums(
  signal: AbortSignal,
  pendingRemovals: Map<string, number>,
  pendingAdditions: Map<string, number>,
): Promise<MediaCollection[]> {
  const cachedAlbums = (await cache.getAllAlbums())
    .filter((a) => a.provider === ENGINE_PROVIDER);

  const allFetched = await getAllUserAlbums(signal);

  const fetchedIds = new Set(allFetched.map((a) => a.id));

  const ops: Promise<void>[] = [];
  for (const cached of cachedAlbums) {
    if (!fetchedIds.has(cached.id) && !pendingAdditions.has(cached.id)) {
      ops.push(
        cache.removeAlbum(ENGINE_PROVIDER, cached.id),
        cache.removeTrackList({ provider: ENGINE_PROVIDER, kind: 'album', id: cached.id }),
      );
    }
  }
  for (const fetched of allFetched) {
    if (!pendingRemovals.has(fetched.id)) {
      ops.push(cache.putAlbum(fetched));
    }
  }
  await Promise.all(ops);

  const finalAlbums: MediaCollection[] = [
    ...allFetched.filter(f => !pendingRemovals.has(f.id)),
    ...cachedAlbums.filter(a => pendingAdditions.has(a.id) && !fetchedIds.has(a.id)),
  ];
  const seen = new Set<string>();
  const deduped = finalAlbums.filter(a => seen.has(a.id) ? false : (seen.add(a.id), true));

  await cache.putMeta('albums', {
    lastValidated: Date.now(),
    totalCount: deduped.length,
  });

  return deduped;
}
