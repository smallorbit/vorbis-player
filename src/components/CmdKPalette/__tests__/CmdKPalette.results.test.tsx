import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Track, AlbumInfo, SpotifyImage } from '@/services/spotify';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { LibrarySearchResult, SearchArtist } from '@/services/cache/librarySearch';

const mockUseLibrarySearch = vi.fn();
vi.mock('@/hooks/useLibrarySearch', () => ({
  useLibrarySearch: (query: string) => mockUseLibrarySearch(query),
}));

import { CmdKPalette } from '../index';

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (!(Element.prototype as { scrollIntoView?: () => void }).scrollIntoView) {
  (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView = () => {};
}

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const makeTrack = (id: string, name: string, artists = 'Artist'): Track => ({
  id,
  provider: 'spotify',
  name,
  artists,
  album: 'Album',
  duration_ms: 200_000,
  uri: `spotify:track:${id}`,
});

const makeAlbum = (id: string, name: string, artists = 'Artist'): AlbumInfo => ({
  id,
  name,
  artists,
  images: [] as SpotifyImage[],
  release_date: '2024-01-01',
  total_tracks: 10,
  uri: `spotify:album:${id}`,
});

const makePlaylist = (id: string, name: string, total = 5): CachedPlaylistInfo => ({
  id,
  name,
  description: null,
  images: [] as SpotifyImage[],
  tracks: { total },
  owner: { display_name: 'Owner' },
});

const makeArtist = (id: string, name: string): SearchArtist => ({ id, name });

const setSearchResult = (result: Partial<LibrarySearchResult>) => {
  mockUseLibrarySearch.mockReturnValue({
    results: {
      tracks: result.tracks ?? [],
      albums: result.albums ?? [],
      artists: result.artists ?? [],
      playlists: result.playlists ?? [],
    },
    isLoading: false,
  });
};

const openPalette = () => {
  act(() => {
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
  });
};

const typeQuery = (text: string) => {
  const input = screen.getByPlaceholderText(/start typing to search your library/i);
  act(() => {
    fireEvent.change(input, { target: { value: text } });
  });
};

describe('CmdKPalette — categorized rendering', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    mockUseLibrarySearch.mockReset();
    setSearchResult({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all four group headings when each bucket has items', () => {
    // #given
    setSearchResult({
      tracks: [makeTrack('t1', 'Karma Police', 'Radiohead')],
      albums: [makeAlbum('a1', 'OK Computer', 'Radiohead')],
      artists: [makeArtist('radiohead', 'Radiohead')],
      playlists: [makePlaylist('p1', 'Chill Mix')],
    });
    render(<CmdKPalette />);
    openPalette();

    // #when
    typeQuery('rad');

    // #then
    expect(screen.getByText('Tracks')).toBeInTheDocument();
    expect(screen.getByText('Albums')).toBeInTheDocument();
    expect(screen.getByText('Artists')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
  });

  it('hides empty groups', () => {
    // #given only tracks have results
    setSearchResult({
      tracks: [makeTrack('t1', 'Karma Police', 'Radiohead')],
    });
    render(<CmdKPalette />);
    openPalette();

    // #when
    typeQuery('rad');

    // #then — Tracks renders, others do not
    expect(screen.getByText('Tracks')).toBeInTheDocument();
    expect(screen.queryByText('Albums')).not.toBeInTheDocument();
    expect(screen.queryByText('Artists')).not.toBeInTheDocument();
    expect(screen.queryByText('Playlists')).not.toBeInTheDocument();
  });

  it('renders groups in fixed order: Tracks, Albums, Artists, Playlists', () => {
    // #given
    setSearchResult({
      tracks: [makeTrack('t1', 'A')],
      albums: [makeAlbum('a1', 'B')],
      artists: [makeArtist('c', 'C')],
      playlists: [makePlaylist('p1', 'D')],
    });
    render(<CmdKPalette />);
    openPalette();
    typeQuery('x');

    // #when — read all four group headings in DOM order
    const tracks = screen.getByText('Tracks');
    const albums = screen.getByText('Albums');
    const artists = screen.getByText('Artists');
    const playlists = screen.getByText('Playlists');

    // #then — each precedes the next in document order
    expect(tracks.compareDocumentPosition(albums) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(albums.compareDocumentPosition(artists) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(artists.compareDocumentPosition(playlists) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows "No results" when all buckets are empty and a query is typed', () => {
    // #given
    setSearchResult({});
    render(<CmdKPalette />);
    openPalette();

    // #when
    typeQuery('zzz');

    // #then
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('does NOT show "No results." when the palette opens with an empty query', () => {
    // #given
    setSearchResult({});
    render(<CmdKPalette />);

    // #when — open without typing anything
    openPalette();

    // #then — "No results." must not appear before the user types
    expect(screen.queryByText(/no results/i)).not.toBeInTheDocument();
  });

  it('renders track subtitle as the artist string', () => {
    // #given
    setSearchResult({
      tracks: [makeTrack('t1', 'Karma Police', 'Radiohead')],
    });
    render(<CmdKPalette />);
    openPalette();
    typeQuery('k');

    // #then
    expect(screen.getByText('Karma Police')).toBeInTheDocument();
    expect(screen.getByText('Radiohead')).toBeInTheDocument();
  });

  it('renders playlist subtitle with track count when available', () => {
    // #given
    setSearchResult({
      playlists: [makePlaylist('p1', 'Chill Mix', 7)],
    });
    render(<CmdKPalette />);
    openPalette();
    typeQuery('mix');

    // #then
    expect(screen.getByText('Chill Mix')).toBeInTheDocument();
    expect(screen.getByText('7 tracks')).toBeInTheDocument();
  });

  it('omits playlist subtitle when track total is missing or zero', () => {
    // #given
    setSearchResult({
      playlists: [makePlaylist('p1', 'Empty Mix', 0)],
    });
    render(<CmdKPalette />);
    openPalette();
    typeQuery('mix');

    // #then
    expect(screen.getByText('Empty Mix')).toBeInTheDocument();
    expect(screen.queryByText(/0 tracks?/)).not.toBeInTheDocument();
  });
});

describe('CmdKPalette — selection routing', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    mockUseLibrarySearch.mockReset();
    setSearchResult({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes onSelectTrack and closes the palette when a track is selected', () => {
    // #given
    const track = makeTrack('t1', 'Karma Police', 'Radiohead');
    setSearchResult({ tracks: [track] });
    const onSelectTrack = vi.fn();
    render(<CmdKPalette onSelectTrack={onSelectTrack} />);
    openPalette();
    typeQuery('karma');

    // #when
    act(() => {
      fireEvent.click(screen.getByTestId('cmdk-item-track'));
    });

    // #then
    expect(onSelectTrack).toHaveBeenCalledTimes(1);
    expect(onSelectTrack).toHaveBeenCalledWith(track);
    expect(
      screen.queryByPlaceholderText(/start typing to search your library/i),
    ).not.toBeInTheDocument();
  });

  it('invokes onSelectAlbum and closes the palette when an album is selected', () => {
    // #given
    const album = makeAlbum('a1', 'OK Computer', 'Radiohead');
    setSearchResult({ albums: [album] });
    const onSelectAlbum = vi.fn();
    render(<CmdKPalette onSelectAlbum={onSelectAlbum} />);
    openPalette();
    typeQuery('ok');

    // #when
    act(() => {
      fireEvent.click(screen.getByTestId('cmdk-item-album'));
    });

    // #then
    expect(onSelectAlbum).toHaveBeenCalledWith(album);
    expect(
      screen.queryByPlaceholderText(/start typing to search your library/i),
    ).not.toBeInTheDocument();
  });

  it('invokes onSelectPlaylist and closes the palette when a playlist is selected', () => {
    // #given
    const playlist = makePlaylist('p1', 'Chill Mix');
    setSearchResult({ playlists: [playlist] });
    const onSelectPlaylist = vi.fn();
    render(<CmdKPalette onSelectPlaylist={onSelectPlaylist} />);
    openPalette();
    typeQuery('chill');

    // #when
    act(() => {
      fireEvent.click(screen.getByTestId('cmdk-item-playlist'));
    });

    // #then
    expect(onSelectPlaylist).toHaveBeenCalledWith(playlist);
    expect(
      screen.queryByPlaceholderText(/start typing to search your library/i),
    ).not.toBeInTheDocument();
  });

  it('invokes onSelectArtist and closes the palette when an artist is selected (deferred fallback)', () => {
    // #given
    const artist = makeArtist('radiohead', 'Radiohead');
    setSearchResult({ artists: [artist] });
    const onSelectArtist = vi.fn();
    render(<CmdKPalette onSelectArtist={onSelectArtist} />);
    openPalette();
    typeQuery('rad');

    // #when
    act(() => {
      fireEvent.click(screen.getByTestId('cmdk-item-artist'));
    });

    // #then
    expect(onSelectArtist).toHaveBeenCalledWith(artist);
    expect(
      screen.queryByPlaceholderText(/start typing to search your library/i),
    ).not.toBeInTheDocument();
  });

  it('clears the query after a selection (next open starts empty)', () => {
    // #given
    setSearchResult({ tracks: [makeTrack('t1', 'X')] });
    const onSelectTrack = vi.fn();
    render(<CmdKPalette onSelectTrack={onSelectTrack} />);
    openPalette();
    typeQuery('x');

    // #when
    act(() => {
      fireEvent.click(screen.getByTestId('cmdk-item-track'));
    });
    openPalette();

    // #then
    const input = screen.getByPlaceholderText(
      /start typing to search your library/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('');
  });
});

describe('CmdKPalette — keyboard navigation', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    mockUseLibrarySearch.mockReset();
    setSearchResult({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects across groups when Enter is pressed (cmdk auto-selects the first match)', () => {
    // #given
    const track = makeTrack('t1', 'Karma Police', 'Radiohead');
    setSearchResult({
      tracks: [track],
      albums: [makeAlbum('a1', 'OK Computer', 'Radiohead')],
    });
    const onSelectTrack = vi.fn();
    const onSelectAlbum = vi.fn();
    render(<CmdKPalette onSelectTrack={onSelectTrack} onSelectAlbum={onSelectAlbum} />);
    openPalette();
    typeQuery('karma');

    // #when — Enter on the input fires the currently-selected (first) item
    const input = screen.getByPlaceholderText(/start typing to search your library/i);
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // #then — the first item (the track) is selected
    expect(onSelectTrack).toHaveBeenCalledWith(track);
    expect(onSelectAlbum).not.toHaveBeenCalled();
  });

  it('moves selection across groups with ArrowDown', () => {
    // #given two groups, one item each
    const track = makeTrack('t1', 'Karma');
    const album = makeAlbum('a1', 'OK Computer');
    setSearchResult({ tracks: [track], albums: [album] });
    const onSelectTrack = vi.fn();
    const onSelectAlbum = vi.fn();
    render(<CmdKPalette onSelectTrack={onSelectTrack} onSelectAlbum={onSelectAlbum} />);
    openPalette();
    typeQuery('o');

    // #when — ArrowDown moves selection from track → album, then Enter
    const input = screen.getByPlaceholderText(/start typing to search your library/i);
    act(() => {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // #then — selection moved to the album
    expect(onSelectAlbum).toHaveBeenCalledWith(album);
    expect(onSelectTrack).not.toHaveBeenCalled();
  });
});
