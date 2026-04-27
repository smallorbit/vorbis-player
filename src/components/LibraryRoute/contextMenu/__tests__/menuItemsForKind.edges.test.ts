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

function makeRequest(overrides: Partial<ContextMenuRequest> = {}): ContextMenuRequest {
  return {
    kind: 'playlist',
    id: 'p1',
    name: 'Test',
    anchorRect: new DOMRect(0, 0, 0, 0),
    ...overrides,
  };
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
      expect(items[items.length - 1].variant).toBe('destructive');
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
      expect(items[0].id).toBe('play-all');
    });

    it('returns only Play All when likedProviderActions=undefined', () => {
      // #given — no likedProviderActions key in actions
      const actions = makeActions();

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

      // #then
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('play-all');
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

    it('Save label remains "Save" when isSaved is false', () => {
      // #given
      const actions = makeActions({ onToggleSave: vi.fn(), isSaved: false });

      // #when
      const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

      // #then
      expect(items.find((i) => i.id === 'toggle-save')?.label).toBe('Save');
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
