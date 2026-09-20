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
    expect(defined(items[0]).id).toBe('play');
    expect(items.find((i) => i.id === 'toggle-save')).toBeDefined();
    expect(defined(items[items.length - 1]).id).toBe('remove-from-history');
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

  it('always labels album toggle-save as Unlike (library only shows liked albums)', () => {
    // #given
    const actions = makeActions({ onToggleSave: vi.fn() });

    // #when
    const items = buildMenuItems(makeRequest({ kind: 'album' }), actions);

    // #then
    expect(items.find((i) => i.id === 'toggle-save')?.label).toBe('Unlike');
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
