/**
 * Types for the Radio feature.
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

// ── Radio progress ──────────────────────────────────────────────────

export type RadioProgressPhase = 'fetching-catalog' | 'generating' | 'resolving' | 'done';
export interface RadioProgress { phase: RadioProgressPhase; trackCount?: number; }

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


// ── Radio state ──────────────────────────────────────────────────────

export interface RadioState {
  /** Whether a radio session is currently active. */
  isActive: boolean;
  /** Description of the current radio seed (e.g., "Radio based on Creep by Radiohead"). */
  seedDescription: string | null;
  /** Whether radio queue is currently being generated. */
  isGenerating: boolean;
  /** Error message from the last radio attempt. */
  error: string | null;
  /** Match stats from the last successful radio generation. */
  lastMatchStats: RadioResult['matchStats'] | null;
}