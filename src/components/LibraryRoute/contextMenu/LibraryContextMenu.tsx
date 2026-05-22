import React, { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { ContextMenuRequest } from '../types';
import type { ProviderId, MediaTrack } from '@/types/domain';
import { isMenuActionError } from './menuItemsForKind';
import { useMenuItems, type UseMenuItemsCallbacks } from './useMenuItems';
import { MenuItemButton, MenuRoot, VirtualAnchor } from './LibraryContextMenu.styled';

export interface LibraryContextMenuProps {
  request: ContextMenuRequest | null;
  onClose: () => void;
  onReturnFocusClose: () => void;
  onPlayCollection: (
    kind: 'playlist' | 'album',
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onAddToQueue?: ((id: string, name: string, provider?: ProviderId) => void | Promise<unknown>) | undefined;
  onPlayNext?: ((
    kind: 'playlist' | 'album',
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void) | undefined;
  onStartRadioForCollection?: ((
    kind: 'playlist' | 'album',
    id: string,
    provider?: ProviderId,
  ) => void) | undefined;
  onPlayLikedTracks: (
    tracks: MediaTrack[],
    collectionId: string,
    collectionName: string,
    provider?: ProviderId,
  ) => Promise<void> | void;
  onQueueLikedTracks?: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined;
}

const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
  request,
  onClose,
  onReturnFocusClose,
  onPlayCollection,
  onAddToQueue,
  onPlayNext,
  onStartRadioForCollection,
  onPlayLikedTracks,
  onQueueLikedTracks,
}) => {
  const closeReasonRef = useRef<'return' | null>(null);

  const closeAfter = useCallback(
    (label: string, fn: () => void | Promise<unknown>): (() => void) =>
      () => {
        onReturnFocusClose();
        Promise.resolve(fn()).catch((err: unknown) => {
          const actionLabel = isMenuActionError(err) ? err.label : label;
          const cause = isMenuActionError(err) ? err.cause : err;
          const causeMessage =
            cause instanceof Error
              ? cause.message
              : typeof cause === 'string'
                ? cause
                : null;
          const message = causeMessage
            ? `Couldn't ${actionLabel.toLowerCase()}: ${causeMessage}. Try again.`
            : `Couldn't ${actionLabel.toLowerCase()}. Try again.`;
          toast(message);
        });
      },
    [onReturnFocusClose],
  );

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }, []);

  const callbacks = useMemo<UseMenuItemsCallbacks>(
    () => ({
      closeAfter,
      onPlayCollection,
      onAddToQueue,
      onPlayNext,
      onStartRadioForCollection,
      onPlayLikedTracks,
      onQueueLikedTracks,
    }),
    [
      closeAfter,
      onPlayCollection,
      onAddToQueue,
      onPlayNext,
      onStartRadioForCollection,
      onPlayLikedTracks,
      onQueueLikedTracks,
    ],
  );

  const items = useMenuItems(request, callbacks);

  if (!request) return null;

  const anchorStyle: React.CSSProperties = {
    left: request.anchorRect.left + request.anchorRect.width / 2,
    top: request.anchorRect.bottom,
  };

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          const shouldReturn = closeReasonRef.current === 'return';
          closeReasonRef.current = null;
          if (shouldReturn) onReturnFocusClose();
          else onClose();
        }
      }}
    >
      <PopoverAnchor asChild>
        <VirtualAnchor aria-hidden style={anchorStyle} />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        data-testid="library-context-menu"
        onEscapeKeyDown={() => {
          closeReasonRef.current = 'return';
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const container = e.currentTarget as HTMLElement | null;
          const first = container?.querySelector<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          );
          first?.focus();
        }}
      >
        <MenuRoot
          role="menu"
          aria-label={`Actions for ${request.name}`}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <MenuItemButton
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              $variant={item.variant}
              onClick={item.onSelect}
              data-testid={`menu-${item.id}`}
            >
              {item.label}
            </MenuItemButton>
          ))}
        </MenuRoot>
      </PopoverContent>
    </Popover>
  );
};

LibraryContextMenu.displayName = 'LibraryContextMenu';
export default LibraryContextMenu;
