/**
 * CatalogMatcher — matches external track references (from Last.fm) against the local Dropbox catalog.
 *
 * Builds in-memory indexes over the catalog for fast lookups.
 * Match priority: MBID (exact) → normalized artist+title (exact).
 */

import type { MediaTrack } from '@/types/domain';
import type { LastFmSimilarTrack, CatalogIndexes, MatchResult } from '@/types/radio';

// ── Name normalization ──────────────────────────────────────────────

export function normalizeForMatching(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')         // strip accents
    .replace(/\s*\(.*?\)\s*/g, '')           // strip parentheticals: (Remastered), (feat. X)
    .replace(/\s*\[.*?\]\s*/g, '')           // strip brackets: [Deluxe Edition]
    .replace(/\s*-\s*(single|ep|remix)$/i, '') // strip trailing suffixes
    .replace(/[^a-z0-9]/g, '')               // strip non-alphanumeric
    .trim();
}

function makeNormalizedKey(artist: string, title: string): string {
  return normalizeForMatching(artist) + '||' + normalizeForMatching(title);
}

// ── Index building ──────────────────────────────────────────────────

export function buildIndexes(tracks: MediaTrack[]): CatalogIndexes {
  const byRecordingMbid = new Map<string, MediaTrack>();
  const byArtistMbid = new Map<string, MediaTrack[]>();
  const byNormalizedKey = new Map<string, MediaTrack[]>();
  const byNormalizedArtist = new Map<string, MediaTrack[]>();

  for (const track of tracks) {
    // MBID indexes
    if (track.musicbrainzRecordingId) {
      byRecordingMbid.set(track.musicbrainzRecordingId, track);
    }
    if (track.musicbrainzArtistId) {
      const list = byArtistMbid.get(track.musicbrainzArtistId) ?? [];
      list.push(track);
      byArtistMbid.set(track.musicbrainzArtistId, list);
    }

    // Name-based indexes
    const key = makeNormalizedKey(track.artists, track.name);
    const keyList = byNormalizedKey.get(key) ?? [];
    keyList.push(track);
    byNormalizedKey.set(key, keyList);

    const normalizedArtist = normalizeForMatching(track.artists);
    const artistList = byNormalizedArtist.get(normalizedArtist) ?? [];
    artistList.push(track);
    byNormalizedArtist.set(normalizedArtist, artistList);
  }

  return { byRecordingMbid, byArtistMbid, byNormalizedKey, byNormalizedArtist };
}

// ── Track matching ──────────────────────────────────────────────────

export function matchTrack(
  candidate: LastFmSimilarTrack,
  indexes: CatalogIndexes,
): MatchResult | null {
  // 1. Try MBID match first
  if (candidate.trackMbid) {
    const match = indexes.byRecordingMbid.get(candidate.trackMbid);
    if (match) {
      return { track: match, confidence: 'mbid', lastfmMatchScore: candidate.matchScore };
    }
  }

  // 2. Try normalized artist + title match
  const key = makeNormalizedKey(candidate.artist, candidate.name);
  const nameMatches = indexes.byNormalizedKey.get(key);
  if (nameMatches && nameMatches.length > 0) {
    return {
      track: nameMatches[0],
      confidence: 'name-exact',
      lastfmMatchScore: candidate.matchScore,
    };
  }

  return null;
}

/**
 * Find all catalog tracks by an artist (by MBID or normalized name).
 */
export function findTracksByArtist(
  artistName: string,
  artistMbid: string | null,
  indexes: CatalogIndexes,
): MediaTrack[] {
  // Try MBID first
  if (artistMbid) {
    const tracks = indexes.byArtistMbid.get(artistMbid);
    if (tracks && tracks.length > 0) return tracks;
  }

  // Fall back to name
  const normalizedArtist = normalizeForMatching(artistName);
  return indexes.byNormalizedArtist.get(normalizedArtist) ?? [];
}
