import { useState, useCallback } from 'react';
import * as React from 'react';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';

export type ItemPopoverState =
  | { kind: 'album'; album: AlbumInfo; rect: DOMRect }
  | { kind: 'playlist'; playlist: PlaylistInfo; rect: DOMRect }
  | null;

export interface UseItemPopoverReturn {
  popover: ItemPopoverState;
  openAlbum: (album: AlbumInfo, event: React.MouseEvent) => void;
  openPlaylist: (playlist: PlaylistInfo, event: React.MouseEvent) => void;
  close: () => void;
}

export function useItemPopover(): UseItemPopoverReturn {
  const [popover, setPopover] = useState<ItemPopoverState>(null);

  const openAlbum = useCallback((album: AlbumInfo, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPopover({ kind: 'album', album, rect: new DOMRect(event.clientX, event.clientY, 0, 0) });
  }, []);

  const openPlaylist = useCallback((playlist: PlaylistInfo, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPopover({ kind: 'playlist', playlist, rect: new DOMRect(event.clientX, event.clientY, 0, 0) });
  }, []);

  const close = useCallback(() => setPopover(null), []);

  return { popover, openAlbum, openPlaylist, close };
}
