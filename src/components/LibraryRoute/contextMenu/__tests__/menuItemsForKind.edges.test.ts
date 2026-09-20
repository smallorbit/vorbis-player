/**
 * Edge-case tests for buildMenuItems beyond builder-2's baseline coverage.
 *
 * Covers:
 *  - recently-played with originalKind='liked' → Play All + remove-from-history
 *  - liked with empty / undefined likedProviderActions → only Play All
 *  - default disabled flags (undefined / false) leave items enabled
 *  - album with isPinned=true → "Unpin" label
 *  - liked never carries Save action regardless of onToggleSave
 */

import { describe, it, expect, vi } from 'vitest';
import { buildMenuItems, type MenuActions } from '../menuItemsForKind';
import type { ContextMenuRequest } from '../../types';
import type { CollectionRef, CollectionSelection, ProviderId } from '@/types/domain';
import { defined } from '@/test/defined';
import { makeCollectionSelection } from '@/test/fixtures';

function makeActions(overrides: Partial<MenuActions> = {}): MenuActions {
  return {
    onPlay: vi.fn(),
    onAddToQueue: vi.fn(),
    onPlayNext: vi.fn(),
    onTogglePin: vi.fn(),
    onStartRadio: vi.fn(),
    ...overrides,
  };
}

interface MakeRequestOptions {
  kind?: 'playlist' | 'album' | 'liked' | 'recently-played';
  id?: string;
  name?: string;
  provider?: ProviderId | undefined;
  selection?: CollectionSelection;
  originalKind?: 'playlist' | 'album' | 'liked';
  recentRef?: CollectionRef;
}

function makeRequest(overrides: MakeRequestOptions = {}): ContextMenuRequest {
  const kind = overrides.kind ?? 'playlist';
  const id = overrides.id ?? 'p1';
  const name = overrides.name ?? 'Test';
  const provider: ProviderId | undefined =
    'provider' in overrides ? overrides.provider : 'spotify';

  const effectiveKind = kind === 'recently-played' ? (overrides.originalKind ?? 'playlist') : kind;
  const selection: CollectionSelection =
    overrides.selection ??
    (effectiveKind === 'liked'
      ? makeCollectionSelection('liked', id, provider ?? 'spotify')
      : makeCollectionSelection(effectiveKind, id, provider ?? 'spotify'));

  const base = {
    id,
    name,
    selection,
    anchorRect: new DOMRect(0, 0, 0, 0),
    ...(provider !== undefined && { provider }),
  };

  if (kind === 'recently-played') {
    return {
      ...base,
      kind: 'recently-played',
      originalKind: overrides.originalKind ?? 'playlist',
      recentRef:
        overrides.recentRef ?? { provider: provider ?? 'spotify', kind: 'playlist', id },
    };
  }
  if (kind === 'album') return { ...base, kind: 'album' };
  if (kind === 'liked') return { ...base, kind: 'liked' };
  return { ...base, kind: 'playlist' };
}

describe('buildMenuItems edges', () => {
  describe('recently-played with originalKind="liked"', () => {
    it('renders liked-shape menu (Play All) + Remove from history', () => {
      // #given
      const actions = makeActions({
        likedProviderActions: [
          { provider: 'spotify', label: 'Play (Spotify)', onPlay: vi.fn() },
        ],
        onRemoveFromHistory: vi.fn(),
      });

      // #when
      const items = buildMenuItems(
        makeRequest({ kind: 'recently-played', originalKind: 'liked' }),
        actions,
      );

      // #then
      expect(items.map((i) => i.id)).toEqual([
        'play-all',
        'play-liked-spotify',
        'remove-from-history',
      ]);
      expect(defined(items[items.length - 1]).variant).toBe('destructive');
    });
  });

  describe('liked kind with empty / missing provider actions', () => {
    it('returns only Play All when likedProviderActions=[]', () => {
      // #given
      const actions = makeActions({ likedProviderActions: [] });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

      // #then
      expect(items).toHaveLength(1);
      expect(defined(items[0]).id).toBe('play-all');
    });

    it('returns only Play All when likedProviderActions=undefined', () => {
      // #given — no likedProviderActions key in actions
      const actions = makeActions();

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

      // #then
      expect(items).toHaveLength(1);
      expect(defined(items[0]).id).toBe('play-all');
    });
  });

  describe('default disabled-flag handling', () => {
    it('Play Next is enabled when playNextDisabled is undefined', () => {
      // #given
      const actions = makeActions(); // playNextDisabled not set

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

      // #then
      const playNext = items.find((i) => i.id === 'play-next');
      expect(playNext?.disabled).toBe(false);
    });

    it('Start Radio is enabled when startRadioDisabled is undefined', () => {
      // #given
      const actions = makeActions(); // startRadioDisabled not set

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

      // #then
      const radio = items.find((i) => i.id === 'start-radio');
      expect(radio?.disabled).toBe(false);
    });

    it('Play Next is enabled when playNextDisabled is explicitly false', () => {
      // #given
      const actions = makeActions({ playNextDisabled: false });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

      // #then
      expect(items.find((i) => i.id === 'play-next')?.disabled).toBe(false);
    });
  });

  describe('album-kind label flips', () => {
    it('Unpin label appears for pinned album', () => {
      // #given
      const actions = makeActions({ onToggleSave: vi.fn(), isPinned: true });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

      // #then
      expect(items.find((i) => i.id === 'toggle-pin')?.label).toBe('Unpin');
    });

    it('toggle-save label stays Unlike for albums regardless of caller flags', () => {
      // #given — library only ever surfaces albums the user has already liked
      const actions = makeActions({ onToggleSave: vi.fn() });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

      // #then
      expect(items.find((i) => i.id === 'toggle-save')?.label).toBe('Unlike');
    });
  });

  describe('liked kind ignores album-only actions', () => {
    it('liked menu has no toggle-save even when onToggleSave provided', () => {
      // #given
      const actions = makeActions({ onToggleSave: vi.fn() });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

      // #then
      expect(items.find((i) => i.id === 'toggle-save')).toBeUndefined();
    });

    it('liked menu has no toggle-pin even when isPinned set', () => {
      // #given
      const actions = makeActions({ isPinned: true });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

      // #then
      expect(items.find((i) => i.id === 'toggle-pin')).toBeUndefined();
    });
  });
});
