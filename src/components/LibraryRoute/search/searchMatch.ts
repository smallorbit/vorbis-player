import type { ProviderId } from '@/types/domain';
import type { LibrarySort } from './useLibrarySearch';

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesQuery(
  item: { name: string; ownerName?: string | null },
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  if (item.name.toLowerCase().includes(normalizedQuery)) return true;
  if (item.ownerName && item.ownerName.toLowerCase().includes(normalizedQuery)) return true;
  return false;
}

export function passesProviderFilter(
  item: { provider?: ProviderId },
  providerFilter: ProviderId[],
): boolean {
  if (providerFilter.length === 0) return true;
  const provider = item.provider ?? 'spotify';
  return providerFilter.includes(provider);
}

export function sortItems<T extends { name: string; added_at?: string }>(
  items: T[],
  sort: LibrarySort,
): T[] {
  if (sort === 'recent') return items;
  const copy = [...items];
  copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') copy.reverse();
  return copy;
}
