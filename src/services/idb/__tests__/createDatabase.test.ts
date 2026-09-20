import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createIdbDatabase, deleteIdbDatabase } from '@/services/idb';

const DB_NAME = 'vorbis-idb-foundation-test';

describe('createIdbDatabase', () => {
  let handle: ReturnType<typeof createIdbDatabase>;

  beforeEach(async () => {
    await deleteIdbDatabase(DB_NAME);
    handle = createIdbDatabase({
      name: DB_NAME,
      version: 1,
      logLabel: 'idbFoundationTest',
      stores: [
        { name: 'items', keyMode: { kind: 'outOfLine' } },
        { name: 'records', keyMode: { kind: 'keyPath', keyPath: 'id' } },
      ],
    });
  });

  afterEach(async () => {
    handle.close();
    await deleteIdbDatabase(DB_NAME);
  });

  it('round-trips out-of-line keyed values', async () => {
    const store = handle.getStore<{ name: string }>('items');
    await store.put('a', { name: 'Alpha' });
    expect(await store.get('a')).toEqual({ name: 'Alpha' });
    expect(await store.getAll()).toEqual([{ name: 'Alpha' }]);
  });

  it('round-trips keyPath-keyed values', async () => {
    const store = handle.getStore<{ id: string; n: number }>('records');
    await store.put('r1', { id: 'r1', n: 7 });
    expect(await store.get('r1')).toEqual({ id: 'r1', n: 7 });
  });

  it('falls back to memory when IndexedDB is unavailable at init', async () => {
    handle.close();
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const fb = createIdbDatabase({
      name: `${DB_NAME}-fb`,
      version: 1,
      logLabel: 'idbFoundationFallback',
      stores: [{ name: 'items', keyMode: { kind: 'outOfLine' } }],
    });
    await fb.init();
    expect(fb.isFallback()).toBe(true);
    const store = fb.getStore<{ name: string }>('items');
    await store.put('x', { name: 'Mem' });
    expect(await store.get('x')).toEqual({ name: 'Mem' });
    fb.close();

    Object.defineProperty(globalThis, 'indexedDB', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it('does not enter permanent fallback after a write soft-fail; overlays the key only', async () => {
    await handle.init();
    expect(handle.isFallback()).toBe(false);

    const db = handle.getDb();
    expect(db).not.toBeNull();

    // Seed a readable row that must stay visible after a later write soft-fail.
    const store = handle.getStore<{ name: string }>('items');
    await store.put('keep', { name: 'Keep Me' });

    const original = db!.transaction.bind(db);
    const spy = vi.spyOn(db!, 'transaction').mockImplementation(
      (storeNames: string | string[] | Iterable<string>, mode?: IDBTransactionMode) => {
        if (mode === 'readwrite') {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        return mode !== undefined ? original(storeNames, mode) : original(storeNames);
      },
    );

    await store.put('new', { name: 'Soft Fail' });

    // #then — whole-DB fallback stays off; seeded IDB row still readable;
    //          soft-failed write is visible via the per-key overlay.
    expect(handle.isFallback()).toBe(false);
    const all = await store.getAll();
    expect(all.map((r) => r.name).sort()).toEqual(['Keep Me', 'Soft Fail']);

    spy.mockRestore();
  });

  it('skips non-evictable stores when clearing for quota', async () => {
    handle.close();
    await deleteIdbDatabase(DB_NAME);
    handle = createIdbDatabase({
      name: DB_NAME,
      version: 1,
      logLabel: 'idbFoundationQuota',
      stores: [
        { name: 'cache', keyMode: { kind: 'outOfLine' } },
        { name: 'likes', keyMode: { kind: 'outOfLine' }, evictableForQuota: false },
      ],
    });
    await handle.init();
    const cache = handle.getStore<{ n: number }>('cache');
    const likes = handle.getStore<{ n: number }>('likes');
    await cache.put('c1', { n: 1 });
    await likes.put('l1', { n: 2 });

    await handle.evictForQuota();

    expect(await cache.get('c1')).toBeUndefined();
    expect(await likes.get('l1')).toEqual({ n: 2 });
  });

  it('drops the closed handle on versionchange and reopens on next init', async () => {
    await handle.init();
    const store = handle.getStore<{ name: string }>('items');
    await store.put('keep', { name: 'Temp' });
    expect(handle.getDb()).not.toBeNull();

    // #when — deleteDatabase fires versionchange on open connections (same
    // mechanism as another tab upgrading), then finishes the wipe
    await deleteIdbDatabase(DB_NAME);

    // #then — handle no longer holds the closed connection
    expect(handle.getDb()).toBeNull();
    expect(handle.isFallback()).toBe(false);

    // Next init reopens a live connection; reads/writes work again
    await handle.init();
    expect(handle.getDb()).not.toBeNull();
    expect(handle.isFallback()).toBe(false);
    expect(await store.get('keep')).toBeUndefined();
    await store.put('again', { name: 'Works' });
    expect(await store.get('again')).toEqual({ name: 'Works' });
  });
});
