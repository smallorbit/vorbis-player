import React, { useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { usePinnedSection, usePlaylistsSection, useAlbumsSection } from '../hooks';
import { toAlbumPlaylistId } from '@/constants/playlist';
import type { ProviderId } from '@/types/domain';
import type { LibraryItemKind } from '../types';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectCollection: (
    kind: LibraryItemKind,
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onSelectCollection }) => {
  const pinned = usePinnedSection();
  const { items: playlists } = usePlaylistsSection({ excludePinned: true });
  const { items: albums } = useAlbumsSection({ excludePinned: true });

  const pinnedItems = pinned.combined;

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const groups = useMemo(
    () => ({ pinnedItems, playlists, albums }),
    [pinnedItems, playlists, albums],
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Search collections..." data-testid="library-palette-input" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {groups.pinnedItems.length > 0 && (
          <CommandGroup heading="Pinned">
            {groups.pinnedItems.map((item) => (
              <CommandItem
                key={`pinned-${item.kind}-${item.provider ?? 'spotify'}-${item.id}`}
                value={`pinned ${item.name}`}
                onSelect={() => {
                  if (item.kind === 'album') {
                    onSelectCollection('album', toAlbumPlaylistId(item.id), item.name, item.provider);
                  } else {
                    onSelectCollection('playlist', item.id, item.name, item.provider);
                  }
                  onClose();
                }}
              >
                {item.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.playlists.length > 0 && (
          <CommandGroup heading="Playlists">
            {groups.playlists.map((p) => (
              <CommandItem
                key={`playlist-${p.provider ?? 'spotify'}-${p.id}`}
                value={`playlist ${p.name}`}
                onSelect={() => {
                  onSelectCollection('playlist', p.id, p.name, p.provider);
                  onClose();
                }}
              >
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.albums.length > 0 && (
          <CommandGroup heading="Albums">
            {groups.albums.map((a) => (
              <CommandItem
                key={`album-${a.provider ?? 'spotify'}-${a.id}`}
                value={`album ${a.name} ${a.artists}`}
                onSelect={() => {
                  onSelectCollection('album', toAlbumPlaylistId(a.id), a.name, a.provider);
                  onClose();
                }}
              >
                {a.name} — {a.artists}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

CommandPalette.displayName = 'CommandPalette';
export default CommandPalette;
