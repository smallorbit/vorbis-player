import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeMediaTrack } from '@/test/fixtures';
import {
  applyEnrichmentResult,
  enrichMetadataFromStream,
} from '../dropboxMetadataEnrichment';

vi.mock('@/utils/id3Parser', () => ({
  parseID3: vi.fn(),
}));

vi.mock('@/providers/dropbox/dropboxArtCache', () => ({
  putTagMetadata: vi.fn().mockResolvedValue(undefined),
}));

import { parseID3 } from '@/utils/id3Parser';
import { putTagMetadata } from '@/providers/dropbox/dropboxArtCache';

describe('dropboxMetadataEnrichment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('parses ID3 tags after the enrichment delay and returns a track patch', async () => {
    // #given
    const track = makeMediaTrack({ name: 'file.mp3', artists: 'Unknown' });
    vi.mocked(parseID3).mockReturnValue({
      title: 'Real Title',
      artist: 'Real Artist',
      album: 'Real Album',
      coverArt: null,
      musicbrainzRecordingId: 'mb-rec',
      musicbrainzArtistId: undefined,
      isrc: 'ISRC123',
    });

    const body = {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new Uint8Array([1, 2, 3]) };
          },
          cancel: vi.fn(),
        };
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body,
      }),
    );

    // #when
    const pending = enrichMetadataFromStream(track, 'https://example.com/a.mp3', {
      isStillCurrent: () => true,
      hasImage: () => false,
      delayMs: 50,
    });
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;

    // #then
    expect(result).not.toBeNull();
    expect(result?.metadataUpdate).toEqual({
      name: 'Real Title',
      artists: 'Real Artist',
      album: 'Real Album',
    });
    expect(result?.trackPatch).toMatchObject({
      name: 'Real Title',
      artists: 'Real Artist',
      album: 'Real Album',
      musicbrainzRecordingId: 'mb-rec',
      isrc: 'ISRC123',
    });
    expect(putTagMetadata).toHaveBeenCalledWith(track.id, {
      name: 'Real Title',
      artists: 'Real Artist',
      album: 'Real Album',
    });
  });

  it('applyEnrichmentResult merges patch onto the live track', () => {
    // #given
    const track = makeMediaTrack({ name: 'file.mp3', artists: 'Unknown' });

    // #when
    const applied = applyEnrichmentResult(track, {
      trackPatch: { name: 'Tagged', musicbrainzRecordingId: 'mb' },
      metadataUpdate: { name: 'Tagged' },
    });

    // #then
    expect(applied.currentTrack.name).toBe('Tagged');
    expect(applied.currentTrack.musicbrainzRecordingId).toBe('mb');
    expect(applied.pendingMetadataUpdate).toEqual({ name: 'Tagged' });
  });
});
