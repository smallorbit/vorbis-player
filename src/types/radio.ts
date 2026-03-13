/**
 * Types for the Radio feature (Dropbox provider).
 * Covers Last.fm API responses, radio seeds, matching, and results.
 */

import type { MediaTrack } from './domain';

// ── Last.fm API response types ──────────────────────────────────────

export interface LastFmSimilarTrack {
  name: string;
  artist: string;
  artistMbid: string | null;
  trackMbid: string | null;
  matchScore: number; // 0.0–1.0
}

export interface LastFmSimilarArtist {
  name: string;
  mbid: string | null;
  matchScore: number; // 0.0–1.0
}

// ── Radio seed types ────────────────────────────────────────────────

export type RadioSeed =
  | { type: 'track'; artist: string; track: string; mbid?: string }
  | { type: 'artist'; artist: string; mbid?: string }
  | { type: 'album'; artist: string; album: string; tracks: { artist: string; name: string }[] };

// ── Catalog matching types ──────────────────────────────────────────

export interface CatalogIndexes {
  /** Primary: MusicBrainz Recording ID → track */
  byRecordingMbid: Map<string, MediaTrack>;
  /** Primary: MusicBrainz Artist ID → tracks */
  byArtistMbid: Map<string, MediaTrack[]>;
  /** Fallback: normalizedArtist + normalizedTitle → tracks */
  byNormalizedKey: Map<string, MediaTrack[]>;
  /** Fallback: normalizedArtist → tracks */
  byNormalizedArtist: Map<string, MediaTrack[]>;
}

export type MatchConfidence = 'mbid' | 'name-exact';

export interface MatchResult {
  track: MediaTrack;
  confidence: MatchConfidence;
  lastfmMatchScore: number;
}

// ── Unmatched suggestion (for cross-provider resolution) ────────────

export interface UnmatchedSuggestion {
  name: string;
  artist: string;
  /** Last.fm similarity score (0.0–1.0). */
  matchScore: number;
}

// ── Radio result ────────────────────────────────────────────────────

export interface RadioResult {
  queue: MediaTrack[];
  seedDescription: string;
  matchStats: {
    lastfmCandidates: number;
    matched: number;
    byMbid: number;
    byName: number;
  };
  /** Last.fm suggestions that didn't match the local catalog, sorted by matchScore descending. */
  unmatchedSuggestions: UnmatchedSuggestion[];
}
