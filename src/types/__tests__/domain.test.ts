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
    const ref: CollectionRef = { provider: 'spotify', kind: 'liked' };
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
    // #given a well-formed key whose provider id is not registered
    // #when
    // #then
    expect(keyToCollectionRef('apple:playlist:abc')).toBeNull();
  });

  it('returns null for a well-formed key with an unregistered provider id', () => {
    // #given
    const key = 'fakeprov:playlist:abc';

    // #when
    const result = keyToCollectionRef(key);

    // #then — must be null, not a partial object
    expect(result).toBeNull();
  });

  it('returns null for unknown kind', () => {
    expect(keyToCollectionRef('spotify:queue:abc')).toBeNull();
  });

  it('round-trips all ref variants', () => {
    // #given
    const refs: CollectionRef[] = [
      { provider: 'spotify', kind: 'playlist', id: 'p1' },
      { provider: 'spotify', kind: 'album', id: 'a1' },
      { provider: 'spotify', kind: 'liked' },
      { provider: 'dropbox', kind: 'folder', id: '/path/to/music' },
    ];

    // #when / #then
    for (const ref of refs) {
      const key = collectionRefToKey(ref);
      const parsed = keyToCollectionRef(key);
      expect(parsed).toEqual(ref);
    }
  });

  it('parses a spotify liked key (no id segment)', () => {
    // #given a key with an empty id segment (the canonical 'liked' serialization)
    // #when
    const parsed = keyToCollectionRef('spotify:liked:');
    // #then — must omit the id field, matching the 'liked' variant shape
    expect(parsed).toEqual({ provider: 'spotify', kind: 'liked' });
  });
});
