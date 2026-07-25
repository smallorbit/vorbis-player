import { describe, it, expect, beforeEach } from 'vitest';
import type { ProviderRegistration } from '@/types/providers';
import { ProviderRegistryImpl } from '../registry';
import { InvalidProviderDescriptorError, ProviderCapabilityMismatchError } from '../errors';

function makeStubDescriptor(id: 'spotify' | 'dropbox', name: string): ProviderRegistration {
  return {
    id,
    name,
    capabilities: {
      hasExternalLink: id === 'spotify',
      ...(id === 'spotify' && { externalLinkLabel: 'Open in Spotify' }),
    },
    auth: {
      providerId: id,
      isAuthenticated: () => false,
      getAccessToken: async () => null,
      beginLogin: async () => {},
      handleCallback: async () => false,
      logout: () => {},
    },
    catalog: {
      providerId: id,
      listCollections: async () => [],
      listTracks: async () => [],
    },
    playback: {
      providerId: id,
      initialize: async () => {},
      playTrack: async () => {},
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
      setVolume: async () => {},
      getState: async () => null,
      subscribe: () => () => {},
    },
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistryImpl;

  beforeEach(() => {
    registry = new ProviderRegistryImpl();
  });

  describe('capability derivation', () => {
    it('derives optional-feature flags from catalog method presence', () => {
      // #given — a bare catalog with none of the optional methods
      const registration = makeStubDescriptor('dropbox', 'Dropbox');

      // #when
      registry.register(registration);

      // #then
      expect(registry.get('dropbox')?.capabilities).toMatchObject({
        hasLikedCollection: false,
        hasSaveTrack: false,
        hasSaveAlbum: false,
        hasTrackSearch: false,
      });
    });

    it('derives true flags when the catalog implements the methods', () => {
      // #given
      const registration = makeStubDescriptor('spotify', 'Spotify');
      registration.catalog = {
        ...registration.catalog,
        getLikedCount: async () => 0,
        setTrackSaved: async () => {},
        isTrackSaved: async () => false,
        setAlbumSaved: async () => {},
        isAlbumSaved: async () => false,
        searchTrack: async () => null,
      };

      // #when
      registry.register(registration);

      // #then
      expect(registry.get('spotify')?.capabilities).toMatchObject({
        hasLikedCollection: true,
        hasSaveTrack: true,
        hasSaveAlbum: true,
        hasTrackSearch: true,
      });
    });
  });

  it('returns undefined for unregistered provider', () => {
    expect(registry.get('spotify')).toBeUndefined();
  });

  it('has() returns false for unregistered provider', () => {
    expect(registry.has('spotify')).toBe(false);
  });

  it('getAll() returns empty array when no providers registered', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('registers and retrieves a provider', () => {
    // #given
    const descriptor = makeStubDescriptor('spotify', 'Spotify');

    // #when
    registry.register(descriptor);

    // #then
    expect(registry.has('spotify')).toBe(true);
    expect(registry.get('spotify')).toMatchObject({ id: 'spotify', name: 'Spotify' });
  });

  it('getAll() returns all registered providers', () => {
    // #given
    const spotify = makeStubDescriptor('spotify', 'Spotify');
    const dropbox = makeStubDescriptor('dropbox', 'Dropbox');

    // #when
    registry.register(spotify);
    registry.register(dropbox);
    const all = registry.getAll();

    // #then
    expect(all).toHaveLength(2);
    expect(all.map((d) => d.id)).toEqual(['spotify', 'dropbox']);
  });

  it('overwrites a provider if registered twice with the same id', () => {
    // #given
    const first = makeStubDescriptor('spotify', 'Spotify v1');
    const second = makeStubDescriptor('spotify', 'Spotify v2');

    // #when
    registry.register(first);
    registry.register(second);

    // #then
    expect(registry.get('spotify')?.name).toBe('Spotify v2');
    expect(registry.getAll()).toHaveLength(1);
  });

  describe('descriptor validation', () => {
    it('rejects a descriptor missing the auth adapter', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      const broken = { ...descriptor, auth: undefined as unknown as ProviderRegistration['auth'] };

      // #when / #then
      expect(() => registry.register(broken)).toThrow(InvalidProviderDescriptorError);
      try {
        registry.register(broken);
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProviderDescriptorError);
        const e = err as InvalidProviderDescriptorError;
        expect(e.providerId).toBe('spotify');
        expect(e.missingAdapter).toBe('auth');
      }
    });

    it('rejects a descriptor missing the catalog adapter', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      const broken = { ...descriptor, catalog: undefined as unknown as ProviderRegistration['catalog'] };

      // #when / #then
      try {
        registry.register(broken);
        throw new Error('expected register to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProviderDescriptorError);
        const e = err as InvalidProviderDescriptorError;
        expect(e.providerId).toBe('spotify');
        expect(e.missingAdapter).toBe('catalog');
      }
    });

    it('rejects a descriptor missing the playback adapter', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      const broken = { ...descriptor, playback: null as unknown as ProviderRegistration['playback'] };

      // #when / #then
      try {
        registry.register(broken);
        throw new Error('expected register to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidProviderDescriptorError);
        const e = err as InvalidProviderDescriptorError;
        expect(e.providerId).toBe('spotify');
        expect(e.missingAdapter).toBe('playback');
      }
    });

    it('rejects hasNativeQueueSync without playback.onQueueChanged', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      descriptor.capabilities.hasNativeQueueSync = true;

      // #when / #then
      expect(() => registry.register(descriptor)).toThrow(ProviderCapabilityMismatchError);
    });

    it('rejects hasContextPlaybackFallback without playback.playCollection', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      descriptor.capabilities.hasContextPlaybackFallback = true;

      // #when / #then
      expect(() => registry.register(descriptor)).toThrow(ProviderCapabilityMismatchError);
    });

    it('does not insert a rejected descriptor into the registry', () => {
      // #given
      const descriptor = makeStubDescriptor('spotify', 'Spotify');
      const broken = { ...descriptor, auth: undefined as unknown as ProviderRegistration['auth'] };

      // #when
      expect(() => registry.register(broken)).toThrow(InvalidProviderDescriptorError);

      // #then
      expect(registry.get('spotify')).toBeUndefined();
      expect(registry.has('spotify')).toBe(false);
      expect(registry.getAll()).toEqual([]);
    });
  });
});
