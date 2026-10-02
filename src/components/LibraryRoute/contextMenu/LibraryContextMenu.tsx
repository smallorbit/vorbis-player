import React, { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { ContextMenuRequest } from '../types';
import type { CollectionSelection, MediaTrack } from '@/types/domain';
import { isMenuActionError } from './menuItemsForKind';
import { useMenuItems, type UseMenuItemsCallbacks } from './useMenuItems';
import { MenuItemButton, MenuRoot, VirtualAnchor } from '@/components/ui/context-menu.styled';
import { useRovingMenuKeyDown } from '@/hooks/useRovingMenuKeyDown';

export interface LibraryContextMenuProps {
  request: ContextMenuRequest | null;
  onClose: () => void;
  onReturnFocusClose: () => void;
  onPlayCollection: (selection: CollectionSelection) => void;
  onAddToQueue?: ((selection: CollectionSelection) => void | Promise<unknown>) | undefined;
  onPlayNext?: ((selection: CollectionSelection) => void) | undefined;
  onPlayLikedTracks: (
    tracks: MediaTrack[],
    selection: CollectionSelection,
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

  const handleMenuKeyDown = useRovingMenuKeyDown();

  const callbacks = useMemo<UseMenuItemsCallbacks>(
    () => ({
      closeAfter,
      onPlayCollection,
      onAddToQueue,
      onPlayNext,
      onPlayLikedTracks,
      onQueueLikedTracks,
    }),
    [
      closeAfter,
      onPlayCollection,
      onAddToQueue,
      onPlayNext,
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
