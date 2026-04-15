import { theme } from '@/styles/theme';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import type { PlaylistInfo } from '../../services/spotify';

export function getLikedSongsGradient(providerId?: string | 'unified'): string {
  if (providerId === 'unified') {
    const allProviders = providerRegistry.getAll();
    const colors = allProviders.map(p => p.color).filter(Boolean);
    if (colors.length >= 2) {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    }
    const fallback = colors[0] ?? theme.colors.accent;
    return `linear-gradient(135deg, ${fallback} 0%, ${fallback} 100%)`;
  }
  const descriptor = providerId ? providerRegistry.get(providerId as ProviderId) : undefined;
  const color = descriptor?.color ?? theme.colors.accent;
  return `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`;
}

/** Minimal playlist row for Liked Songs — used to open the same popover as other playlists in the drawer grid. */
export function likedSongsAsPlaylistInfo(provider?: ProviderId): PlaylistInfo {
  return {
    id: LIKED_SONGS_ID,
    name: LIKED_SONGS_NAME,
    description: null,
    images: [],
    tracks: null,
    owner: null,
    provider,
  };
}
