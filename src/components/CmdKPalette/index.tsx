import { useCallback, useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLibrarySearch } from '@/hooks/useLibrarySearch';
import type { AlbumInfo, Track } from '@/services/spotify';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { SearchArtist } from '@/services/cache/librarySearch';
import { useIsTouchDevice } from './useIsTouchDevice';

const PLACEHOLDER = 'Start typing to search your library';

export interface CmdKPaletteProps {
  /** Called when a track is selected — implementations should enqueue and close the palette. */
  onSelectTrack?: (track: Track) => void;
  /** Called when an album is selected — implementations should open it in the Library view. */
  onSelectAlbum?: (album: AlbumInfo) => void;
  /** Called when a playlist is selected — implementations should open it in the Library view. */
  onSelectPlaylist?: (playlist: CachedPlaylistInfo) => void;
  /**
   * Called when an artist is selected.
   *
   * Note: there is no programmatic "filter Library by artist" mechanism today —
   * see #1408 deferral. The default routing in AudioPlayer falls back to opening
   * Library without a filter; a follow-up issue should add filter-by-artist.
   */
  onSelectArtist?: (artist: SearchArtist) => void;
}

interface ItemSubtitleProps {
  text?: string;
}

const ItemSubtitle = ({ text }: ItemSubtitleProps): JSX.Element | null => {
  if (!text) return null;
  return (
    <span className="ml-2 truncate text-xs text-muted-foreground" data-testid="cmdk-item-subtitle">
      {text}
    </span>
  );
};

const playlistSubtitle = (playlist: CachedPlaylistInfo): string | undefined => {
  const total = playlist.tracks?.total;
  if (typeof total !== 'number' || total <= 0) return undefined;
  return total === 1 ? '1 track' : `${total} tracks`;
};

export const CmdKPalette = ({
  onSelectTrack,
  onSelectAlbum,
  onSelectPlaylist,
  onSelectArtist,
}: CmdKPaletteProps = {}): JSX.Element | null => {
  const isTouch = useIsTouchDevice();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results } = useLibrarySearch(query);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (isTouch) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTouch]);

  if (isTouch) return null;

  const { tracks, albums, artists, playlists } = results;
  const hasAny =
    tracks.length > 0 || albums.length > 0 || artists.length > 0 || playlists.length > 0;

  const handleTrack = (track: Track): void => {
    onSelectTrack?.(track);
    closePalette();
  };
  const handleAlbum = (album: AlbumInfo): void => {
    onSelectAlbum?.(album);
    closePalette();
  };
  const handlePlaylist = (playlist: CachedPlaylistInfo): void => {
    onSelectPlaylist?.(playlist);
    closePalette();
  };
  const handleArtist = (artist: SearchArtist): void => {
    onSelectArtist?.(artist);
    closePalette();
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <DialogDescription className="sr-only">
        Search across your music library.
      </DialogDescription>
      <CommandInput
        placeholder={PLACEHOLDER}
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <CommandList>
        {!hasAny && <CommandEmpty>No results.</CommandEmpty>}

        {tracks.length > 0 && (
          <CommandGroup heading="Tracks">
            {tracks.map((track) => (
              <CommandItem
                key={`track:${track.id}`}
                value={`track:${track.id}:${track.name}:${track.artists}`}
                onSelect={() => handleTrack(track)}
                data-testid="cmdk-item-track"
              >
                <span className="truncate">{track.name}</span>
                <ItemSubtitle text={track.artists} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {albums.length > 0 && (
          <CommandGroup heading="Albums">
            {albums.map((album) => (
              <CommandItem
                key={`album:${album.id}`}
                value={`album:${album.id}:${album.name}:${album.artists}`}
                onSelect={() => handleAlbum(album)}
                data-testid="cmdk-item-album"
              >
                <span className="truncate">{album.name}</span>
                <ItemSubtitle text={album.artists} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {artists.length > 0 && (
          <CommandGroup heading="Artists">
            {artists.map((artist) => (
              <CommandItem
                key={`artist:${artist.id}`}
                value={`artist:${artist.id}:${artist.name}`}
                onSelect={() => handleArtist(artist)}
                data-testid="cmdk-item-artist"
              >
                <span className="truncate">{artist.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {playlists.length > 0 && (
          <CommandGroup heading="Playlists">
            {playlists.map((playlist) => (
              <CommandItem
                key={`playlist:${playlist.id}`}
                value={`playlist:${playlist.id}:${playlist.name}`}
                onSelect={() => handlePlaylist(playlist)}
                data-testid="cmdk-item-playlist"
              >
                <span className="truncate">{playlist.name}</span>
                <ItemSubtitle text={playlistSubtitle(playlist)} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CmdKPalette;
