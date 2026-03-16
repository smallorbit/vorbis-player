/**
 * RadioService — orchestrates radio queue generation.
 *
 * Ties together LastFmClient and CatalogMatcher to produce a queue of
 * tracks similar to a given seed (track, artist, or album).
 * Provider-agnostic: works with any catalog of MediaTracks.
 */

import type { MediaTrack } from '@/types/domain';
import type { RadioSeed, RadioResult, CatalogIndexes, MatchResult, UnmatchedSuggestion } from '@/types/radio';
import { getSimilarTracks, getSimilarArtists } from './lastfm';
import { buildIndexes, matchTrack, findTracksByArtist } from './catalogMatcher';

const MAX_QUEUE_SIZE = 25;
const MIN_TRACK_THRESHOLD = 5;
const MAX_CONCURRENT_LASTFM = 3;

/**
 * Generate a radio queue from a seed, matching Last.fm recommendations
 * against the provided catalog tracks.
 */
export async function generateRadioQueue(
  seed: RadioSeed,
  catalogTracks: MediaTrack[],
): Promise<RadioResult> {
  const indexes = buildIndexes(catalogTracks);

  switch (seed.type) {
    case 'track':
      return generateFromTrack(seed, indexes);
    case 'artist':
      return generateFromArtist(seed, indexes);
    case 'album':
      return generateFromAlbum(seed, indexes);
  }
}

// ── Track seed strategy ─────────────────────────────────────────────

async function generateFromTrack(
  seed: Extract<RadioSeed, { type: 'track' }>,
  indexes: CatalogIndexes,
): Promise<RadioResult> {
  const matches: MatchResult[] = [];
  const unmatched: UnmatchedSuggestion[] = [];
  const seenIds = new Set<string>();
  const seenUnmatchedKeys = new Set<string>();

  const candidates = await getSimilarTracks(seed.artist, seed.track, 25);
  const lastfmCandidates = candidates.length;

  for (const candidate of candidates) {
    const result = matchTrack(candidate, indexes);
    if (result && !seenIds.has(result.track.id)) {
      seenIds.add(result.track.id);
      matches.push(result);
    } else if (!result) {
      const key = `${candidate.artist.toLowerCase()}||${candidate.name.toLowerCase()}`;
      if (!seenUnmatchedKeys.has(key)) {
        seenUnmatchedKeys.add(key);
        unmatched.push({ name: candidate.name, artist: candidate.artist, matchScore: candidate.matchScore });
      }
    }
  }

  if (matches.length < MIN_TRACK_THRESHOLD) {
    const similarArtists = await getSimilarArtists(seed.artist, 10);
    for (const artist of similarArtists) {
      const artistTracks = findTracksByArtist(artist.name, artist.mbid, indexes);
      let added = 0;
      for (const track of artistTracks) {
        if (!seenIds.has(track.id) && added < 3) {
          seenIds.add(track.id);
          matches.push({
            track,
            confidence: artist.mbid ? 'mbid' : 'name-exact',
            lastfmMatchScore: artist.matchScore * 0.5,
          });
          added++;
        }
      }
    }
  }

  const filteredMatches = excludeSeedTrack(matches, seed.artist, seed.track);

  return buildResult(filteredMatches, unmatched, lastfmCandidates, `Radio based on ${seed.track} by ${seed.artist}`);
}

// ── Artist seed strategy ────────────────────────────────────────────

async function generateFromArtist(
  seed: Extract<RadioSeed, { type: 'artist' }>,
  indexes: CatalogIndexes,
): Promise<RadioResult> {
  const matches: MatchResult[] = [];
  const seenIds = new Set<string>();

  const similarArtists = await getSimilarArtists(seed.artist, 30);
  let lastfmCandidates = 0;

  for (const artist of similarArtists) {
    const artistTracks = findTracksByArtist(artist.name, artist.mbid, indexes);
    lastfmCandidates += artistTracks.length;

    const selected = artistTracks.slice(0, 5);
    for (const track of selected) {
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        matches.push({
          track,
          confidence: artist.mbid ? 'mbid' : 'name-exact',
          lastfmMatchScore: artist.matchScore,
        });
      }
    }
  }

  const seedArtistTracks = findTracksByArtist(seed.artist, seed.mbid ?? null, indexes);
  for (const track of seedArtistTracks) {
    if (!seenIds.has(track.id)) {
      seenIds.add(track.id);
      matches.push({
        track,
        confidence: 'name-exact',
        lastfmMatchScore: 1.0,
      });
    }
  }

  return buildResult(matches, [], lastfmCandidates, `Radio based on ${seed.artist}`);
}

// ── Album seed strategy ─────────────────────────────────────────────

async function generateFromAlbum(
  seed: Extract<RadioSeed, { type: 'album' }>,
  indexes: CatalogIndexes,
): Promise<RadioResult> {
  const matches: MatchResult[] = [];
  const unmatched: UnmatchedSuggestion[] = [];
  const seenIds = new Set<string>();
  const seenUnmatchedKeys = new Set<string>();
  let totalCandidates = 0;

  const sampled = seed.tracks.slice(0, 5);

  const chunks = chunkArray(sampled, MAX_CONCURRENT_LASTFM);
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (albumTrack) => {
        const candidates = await getSimilarTracks(albumTrack.artist, albumTrack.name, 25);
        return candidates;
      }),
    );

    for (const candidates of results) {
      totalCandidates += candidates.length;
      for (const candidate of candidates) {
        const result = matchTrack(candidate, indexes);
        if (result && !seenIds.has(result.track.id)) {
          seenIds.add(result.track.id);
          matches.push(result);
        } else if (!result) {
          const key = `${candidate.artist.toLowerCase()}||${candidate.name.toLowerCase()}`;
          if (!seenUnmatchedKeys.has(key)) {
            seenUnmatchedKeys.add(key);
            unmatched.push({ name: candidate.name, artist: candidate.artist, matchScore: candidate.matchScore });
          }
        }
      }
    }
  }

  const filteredMatches = matches.filter((m) => {
    const normalizedAlbum = m.track.album.toLowerCase();
    return normalizedAlbum !== seed.album.toLowerCase();
  });

  return buildResult(filteredMatches, unmatched, totalCandidates, `Radio based on ${seed.album} by ${seed.artist}`);
}

// ── Helpers ─────────────────────────────────────────────────────────

function excludeSeedTrack(matches: MatchResult[], seedArtist: string, seedTrack: string): MatchResult[] {
  const normalizedArtist = seedArtist.toLowerCase();
  const normalizedTrack = seedTrack.toLowerCase();
  return matches.filter((m) => {
    return !(m.track.artists.toLowerCase() === normalizedArtist && m.track.name.toLowerCase() === normalizedTrack);
  });
}

function buildResult(
  matches: MatchResult[],
  unmatched: UnmatchedSuggestion[],
  lastfmCandidates: number,
  seedDescription: string,
): RadioResult {
  matches.sort((a, b) => b.lastfmMatchScore - a.lastfmMatchScore);

  const queue = matches.slice(0, MAX_QUEUE_SIZE).map((m) => m.track);

  const byMbid = matches.filter((m) => m.confidence === 'mbid').length;
  const byName = matches.filter((m) => m.confidence === 'name-exact').length;

  unmatched.sort((a, b) => b.matchScore - a.matchScore);

  return {
    queue,
    seedDescription,
    matchStats: {
      lastfmCandidates,
      matched: queue.length,
      byMbid: Math.min(byMbid, queue.length),
      byName: Math.min(byName, queue.length),
    },
    unmatchedSuggestions: unmatched,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
