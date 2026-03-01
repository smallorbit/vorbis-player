import { describe, it, expect } from 'vitest';
import { collectionRefToKey, keyToCollectionRef } from '@/types/domain';
import type { CollectionRef } from '@/types/domain';

describe('collectionRefToKey', () => {
  it('serializes a spotify playlist ref', () => {
    const ref: CollectionRef = { provider: 'spotify', kind: 'playlist', id: 'abc123' };
    expect(collectionRefToKey(ref)).toBe('spotify:playlist:abc123');
  });

  it('serializes a spotify album ref', () => {
    const ref: CollectionRef = { provider: 'spotify', kind: 'album', id: 'xyz789' };
    expect(collectionRefToKey(ref)).toBe('spotify:album:xyz789');
  });

  it('serializes a dropbox folder ref', () => {
    const ref: CollectionRef = { provider: 'dropbox', kind: 'folder', id: '/music/jazz' };
    expect(collectionRefToKey(ref)).toBe('dropbox:folder:/music/jazz');
  });

  it('serializes a spotify liked ref', () => {
    const ref: CollectionRef = { provider: 'spotify', kind: 'liked', id: '' };
    expect(collectionRefToKey(ref)).toBe('spotify:liked:');
  });
});

describe('keyToCollectionRef', () => {
  it('parses a spotify playlist key', () => {
    expect(keyToCollectionRef('spotify:playlist:abc123')).toEqual({
      provider: 'spotify',
      kind: 'playlist',
      id: 'abc123',
    });
  });

  it('parses a spotify album key', () => {
    expect(keyToCollectionRef('spotify:album:xyz789')).toEqual({
      provider: 'spotify',
      kind: 'album',
      id: 'xyz789',
    });
  });

  it('parses a dropbox folder key with colons in the id', () => {
    expect(keyToCollectionRef('dropbox:folder:/music/jazz')).toEqual({
      provider: 'dropbox',
      kind: 'folder',
      id: '/music/jazz',
    });
  });

  it('returns null for invalid keys with fewer than 3 parts', () => {
    expect(keyToCollectionRef('spotify')).toBeNull();
    expect(keyToCollectionRef('spotify:playlist')).toBeNull();
  });

  it('returns null for unknown provider', () => {
    expect(keyToCollectionRef('apple:playlist:abc')).toBeNull();
  });

  it('returns null for unknown kind', () => {
    expect(keyToCollectionRef('spotify:queue:abc')).toBeNull();
  });

  it('round-trips all ref variants', () => {
    const refs: CollectionRef[] = [
      { provider: 'spotify', kind: 'playlist', id: 'p1' },
      { provider: 'spotify', kind: 'album', id: 'a1' },
      { provider: 'spotify', kind: 'liked', id: '' },
      { provider: 'dropbox', kind: 'folder', id: '/path/to/music' },
    ];

    for (const ref of refs) {
      const key = collectionRefToKey(ref);
      const parsed = keyToCollectionRef(key);
      expect(parsed).toEqual(ref);
    }
  });
});
