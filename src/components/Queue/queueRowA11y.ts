import type { MediaTrack } from '@/types/domain';

export function formatQueueRowAriaLabel(track: MediaTrack, isSelected: boolean): string {
  const artists = track.artists?.trim();
  const base = artists ? `${track.name}, ${artists}` : track.name;
  return isSelected ? `${base}, now playing` : base;
}

export function isQueueRowActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
