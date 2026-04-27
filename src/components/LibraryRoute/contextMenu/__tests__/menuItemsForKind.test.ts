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

describe('buildMenuItems', () => {
  it('builds 5 items for playlist kind', () => {
    // #given
    const actions = makeActions();

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.map((i) => i.id)).toEqual([
      'play',
      'add-to-queue',
      'play-next',
      'toggle-pin',
      'start-radio',
    ]);
  });

  it('builds 6 items for album kind when toggleSave provided', () => {
    // #given
    const actions = makeActions({ onToggleSave: vi.fn() });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

    // #then
    expect(items.map((i) => i.id)).toEqual([
      'play',
      'add-to-queue',
      'play-next',
      'toggle-pin',
      'toggle-save',
      'start-radio',
    ]);
  });

  it('omits Save action when onToggleSave is undefined', () => {
    // #given
    const actions = makeActions();

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

    // #then
    expect(items.find((i) => i.id === 'toggle-save')).toBeUndefined();
  });

  it('builds Play All + per-provider entries for liked kind', () => {
    // #given
    const actions = makeActions({
      likedProviderActions: [
        { provider: 'spotify', label: 'Play (Spotify)', onPlay: vi.fn() },
        { provider: 'dropbox', label: 'Play (Dropbox)', onPlay: vi.fn() },
      ],
    });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'liked' }), actions);

    // #then
    expect(items.map((i) => i.id)).toEqual([
      'play-all',
      'play-liked-spotify',
      'play-liked-dropbox',
    ]);
  });

  it('dispatches recently-played by originalKind = album', () => {
    // #given
    const actions = makeActions({ onToggleSave: vi.fn(), onRemoveFromHistory: vi.fn() });

    // #when
    const items = buildMenuItems(
      makeRequest({ kind: 'recently-played', originalKind: 'album' }),
      actions,
    );

    // #then
    expect(items[0].id).toBe('play');
    expect(items.find((i) => i.id === 'toggle-save')).toBeDefined();
    expect(items[items.length - 1].id).toBe('remove-from-history');
  });

  it('appends destructive Remove from history for recently-played', () => {
    // #given
    const actions = makeActions({ onRemoveFromHistory: vi.fn() });

    // #when
    const items = buildMenuItems(
      makeRequest({ kind: 'recently-played', originalKind: 'playlist' }),
      actions,
    );

    // #then
    const remove = items.find((i) => i.id === 'remove-from-history');
    expect(remove).toBeDefined();
    expect(remove?.variant).toBe('destructive');
  });

  it('does not append Remove from history when onRemoveFromHistory undefined', () => {
    // #given
    const actions = makeActions();

    // #when
    const items = buildMenuItems(
      makeRequest({ kind: 'recently-played', originalKind: 'playlist' }),
      actions,
    );

    // #then
    expect(items.find((i) => i.id === 'remove-from-history')).toBeUndefined();
  });

  it('flips Pin label to Unpin when isPinned=true', () => {
    // #given
    const actions = makeActions({ isPinned: true });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.find((i) => i.id === 'toggle-pin')?.label).toBe('Unpin');
  });

  it('flips Save label to Unsave when isSaved=true', () => {
    // #given
    const actions = makeActions({ onToggleSave: vi.fn(), isSaved: true });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

    // #then
    expect(items.find((i) => i.id === 'toggle-save')?.label).toBe('Unsave');
  });

  it('marks Start Radio disabled when startRadioDisabled=true', () => {
    // #given
    const actions = makeActions({ startRadioDisabled: true });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.find((i) => i.id === 'start-radio')?.disabled).toBe(true);
  });

  it('marks Play Next disabled when playNextDisabled=true', () => {
    // #given
    const actions = makeActions({ playNextDisabled: true });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.find((i) => i.id === 'play-next')?.disabled).toBe(true);
  });

  it('adds queue-liked item for playlist when onQueueLikedFromCollection provided', () => {
    // #given
    const actions = makeActions({ onQueueLikedFromCollection: vi.fn() });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.find((i) => i.id === 'queue-liked')).toBeDefined();
    expect(items.find((i) => i.id === 'queue-liked')?.label).toBe('Queue Liked Songs');
  });

  it('adds queue-liked item for album when onQueueLikedFromCollection provided', () => {
    // #given
    const actions = makeActions({ onQueueLikedFromCollection: vi.fn() });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

    // #then
    expect(items.find((i) => i.id === 'queue-liked')).toBeDefined();
  });

  it('omits queue-liked item when onQueueLikedFromCollection is undefined', () => {
    // #given
    const actions = makeActions();

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'playlist' }), actions);

    // #then
    expect(items.find((i) => i.id === 'queue-liked')).toBeUndefined();
  });
});
