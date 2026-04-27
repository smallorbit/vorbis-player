import React, { useMemo } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import {
  usePinnedSection,
  useRecentlyPlayedSection,
  usePlaylistsSection,
  useAlbumsSection,
} from '../hooks';
import LibraryCard from '../card/LibraryCard';
import Section from '../sections/Section';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import type { ProviderId } from '@/types/domain';
import type { LibrarySearchState } from '../search/useLibrarySearch';
import { matchesQuery, normalizeQuery, passesProviderFilter, sortItems } from '../search/searchMatch';
import { SeeAllRoot } from './views.styled';

export interface SearchResultsViewProps {
  search: LibrarySearchState;
  onSelectCollection: (
    kind: LibraryItemKind,
    id: string,
    name: string,
    provider?: ProviderId,
  ) => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
}

const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  search,
  onSelectCollection,
  onContextMenuRequest,
}) => {
  const { hasMultipleProviders } = useProviderContext();
  const showProviderBadges = hasMultipleProviders;

  const { combined: pinned } = usePinnedSection();
  const { items: recently } = useRecentlyPlayedSection();
  const { items: playlists } = usePlaylistsSection({ excludePinned: true });
  const { items: albums } = useAlbumsSection({ excludePinned: true });

  const q = normalizeQuery(search.query);

  const showPlaylists = search.kindFilter.length === 0 || search.kindFilter.includes('playlist');
  const showAlbums = search.kindFilter.length === 0 || search.kindFilter.includes('album');

  const pinnedFiltered = useMemo(
    () =>
      pinned
        .filter((p) => matchesQuery({ name: p.name }, q))
        .filter((p) => passesProviderFilter({ provider: p.provider }, search.providerFilter))
        .filter((p) => (p.kind === 'album' ? showAlbums : showPlaylists)),
    [pinned, q, search.providerFilter, showAlbums, showPlaylists],
  );

  const recentlyFiltered = useMemo(
    () =>
      recently.filter((entry) => {
        if (entry.ref.kind === 'album' && !showAlbums) return false;
        if (entry.ref.kind === 'playlist' && !showPlaylists) return false;
        if (entry.ref.kind === 'liked') return false;
        if (!matchesQuery({ name: entry.name }, q)) return false;
        if (!passesProviderFilter({ provider: entry.ref.provider }, search.providerFilter)) return false;
        return true;
      }),
    [recently, q, search.providerFilter, showAlbums, showPlaylists],
  );

  const playlistsFiltered = useMemo(
    () =>
      showPlaylists
        ? sortItems(
            playlists
              .filter((p) => matchesQuery({ name: p.name }, q))
              .filter((p) => passesProviderFilter({ provider: p.provider }, search.providerFilter)),
            search.sort,
          )
        : [],
    [playlists, q, search.providerFilter, search.sort, showPlaylists],
  );

  const albumsFiltered = useMemo(
    () =>
      showAlbums
        ? sortItems(
            albums
              .filter((a) => matchesQuery({ name: a.name, ownerName: a.artists }, q))
              .filter((a) => passesProviderFilter({ provider: a.provider }, search.providerFilter)),
            search.sort,
          )
        : [],
    [albums, q, search.providerFilter, search.sort, showAlbums],
  );

  const totalResults =
    pinnedFiltered.length + recentlyFiltered.length + playlistsFiltered.length + albumsFiltered.length;

  if (totalResults === 0) {
    return (
      <SeeAllRoot data-testid="library-search-results">
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          No results for &ldquo;{search.query.trim()}&rdquo;.
        </div>
      </SeeAllRoot>
    );
  }

  return (
    <SeeAllRoot data-testid="library-search-results">
      {pinnedFiltered.length > 0 && (
        <Section title="Pinned" id="search-pinned" layout="grid">
          {pinnedFiltered.map((item) => (
            <LibraryCard
              key={`${item.kind}-${item.provider ?? 'default'}-${item.id}`}
              kind={item.kind}
              id={item.id}
              provider={item.provider}
              name={item.name}
              imageUrl={item.imageUrl}
              showProviderBadge={showProviderBadges}
              variant="grid"
              onSelect={() => onSelectCollection(item.kind, item.id, item.name, item.provider)}
              onContextMenuRequest={onContextMenuRequest}
            />
          ))}
        </Section>
      )}
      {recentlyFiltered.length > 0 && (
        <Section title="Recently Played" id="search-recent" layout="grid">
          {recentlyFiltered.map((entry) => {
            const cardKind: LibraryItemKind = entry.ref.kind === 'album' ? 'album' : 'playlist';
            const id = entry.ref.kind === 'liked' ? 'liked' : entry.ref.id;
            return (
              <LibraryCard
                key={`${entry.ref.provider}-${entry.ref.kind}-${id}`}
                kind={cardKind}
                id={id}
                provider={entry.ref.provider}
                name={entry.name}
                imageUrl={entry.imageUrl ?? undefined}
                showProviderBadge={showProviderBadges}
                variant="grid"
                onSelect={() => onSelectCollection(cardKind, id, entry.name, entry.ref.provider)}
                onContextMenuRequest={onContextMenuRequest}
              />
            );
          })}
        </Section>
      )}
      {playlistsFiltered.length > 0 && (
        <Section title="Playlists" id="search-playlists" layout="grid">
          {playlistsFiltered.map((p) => (
            <LibraryCard
              key={`${p.provider ?? 'spotify'}-${p.id}`}
              kind="playlist"
              id={p.id}
              provider={p.provider}
              name={p.name}
              imageUrl={p.images?.[0]?.url}
              showProviderBadge={showProviderBadges}
              variant="grid"
              onSelect={() => onSelectCollection('playlist', p.id, p.name, p.provider)}
              onContextMenuRequest={onContextMenuRequest}
            />
          ))}
        </Section>
      )}
      {albumsFiltered.length > 0 && (
        <Section title="Albums" id="search-albums" layout="grid">
          {albumsFiltered.map((a) => (
            <LibraryCard
              key={`${a.provider ?? 'spotify'}-${a.id}`}
              kind="album"
              id={a.id}
              provider={a.provider}
              name={a.name}
              subtitle={a.artists}
              imageUrl={a.images?.[0]?.url}
              showProviderBadge={showProviderBadges}
              variant="grid"
              onSelect={() => onSelectCollection('album', a.id, a.name, a.provider)}
              onContextMenuRequest={onContextMenuRequest}
            />
          ))}
        </Section>
      )}
    </SeeAllRoot>
  );
};

SearchResultsView.displayName = 'SearchResultsView';
export default SearchResultsView;
