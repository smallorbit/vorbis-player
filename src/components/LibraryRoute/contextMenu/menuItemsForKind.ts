import type { ProviderId } from '@/types/domain';
import type { ContextMenuRequest } from '../types';

interface MenuActionError {
  readonly type: 'menu-action-error';
  readonly label: string;
  readonly cause: unknown;
}

export function isMenuActionError(err: unknown): err is MenuActionError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['type'] === 'menu-action-error'
  );
}

export function createMenuActionError(label: string, cause: unknown): MenuActionError {
  return { type: 'menu-action-error', label, cause };
}

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

export interface MenuActions {
  onPlay: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onTogglePin: () => void;
  onToggleSave?: (() => void) | undefined;
  onStartRadio: () => void;
  onQueueLikedFromCollection?: (() => void) | undefined;
  likedProviderActions?: Array<{ provider: ProviderId; label: string; onPlay: () => void }> | undefined;
  onRemoveFromHistory?: (() => void) | undefined;
  isPinned?: boolean | undefined;
  startRadioDisabled?: boolean | undefined;
  playNextDisabled?: boolean | undefined;
}

function buildCommonItems(actions: MenuActions): MenuItem[] {
  return [
    { id: 'play', label: 'Play', onSelect: actions.onPlay },
    { id: 'add-to-queue', label: 'Add to Queue', onSelect: actions.onAddToQueue },
    {
      id: 'play-next',
      label: 'Play Next',
      onSelect: actions.onPlayNext,
      disabled: actions.playNextDisabled === true,
    },
    {
      id: 'toggle-pin',
      label: actions.isPinned ? 'Unpin' : 'Pin',
      onSelect: actions.onTogglePin,
    },
  ];
}

function buildPlaylistItems(actions: MenuActions): MenuItem[] {
  const items = buildCommonItems(actions);
  items.push({
    id: 'start-radio',
    label: 'Start Radio',
    onSelect: actions.onStartRadio,
    disabled: actions.startRadioDisabled === true,
  });
  if (actions.onQueueLikedFromCollection) {
    items.push({
      id: 'queue-liked',
      label: 'Queue Liked Songs',
      onSelect: actions.onQueueLikedFromCollection,
    });
  }
  return items;
}

function buildAlbumItems(actions: MenuActions): MenuItem[] {
  const items = buildCommonItems(actions);
  if (actions.onToggleSave) {
    // Library only surfaces albums the user has already liked, so the toggle is
    // always Unlike. If the menu is reused in a non-library context (e.g. search
    // results) the caller should branch via an explicit prop, not by inferring
    // from a saved flag. See #1395.
    items.push({
      id: 'toggle-save',
      label: 'Unlike',
      onSelect: actions.onToggleSave,
    });
  }
  items.push({
    id: 'start-radio',
    label: 'Start Radio',
    onSelect: actions.onStartRadio,
    disabled: actions.startRadioDisabled === true,
  });
  if (actions.onQueueLikedFromCollection) {
    items.push({
      id: 'queue-liked',
      label: 'Queue Liked Songs',
      onSelect: actions.onQueueLikedFromCollection,
    });
  }
  return items;
}

function buildLikedItems(actions: MenuActions): MenuItem[] {
  const items: MenuItem[] = [
    { id: 'play-all', label: 'Play All', onSelect: actions.onPlay },
  ];
  for (const liked of actions.likedProviderActions ?? []) {
    items.push({
      id: `play-liked-${liked.provider}`,
      label: liked.label,
      onSelect: liked.onPlay,
    });
  }
  return items;
}

export function buildMenuItems(request: ContextMenuRequest, actions: MenuActions): MenuItem[] {
  let items: MenuItem[];
  let isRecentlyPlayed = false;

  if (request.kind === 'recently-played') {
    isRecentlyPlayed = true;
    if (request.originalKind === 'album') items = buildAlbumItems(actions);
    else if (request.originalKind === 'liked') items = buildLikedItems(actions);
    else items = buildPlaylistItems(actions);
  } else if (request.kind === 'album') {
    items = buildAlbumItems(actions);
  } else if (request.kind === 'liked') {
    items = buildLikedItems(actions);
  } else {
    items = buildPlaylistItems(actions);
  }

  if (isRecentlyPlayed && actions.onRemoveFromHistory) {
    items.push({
      id: 'remove-from-history',
      label: 'Remove from history',
      onSelect: actions.onRemoveFromHistory,
      variant: 'destructive',
    });
  }

  return items;
}
