import { describe, it, expect } from 'vitest';
import { parseID3 } from '../id3Parser';

/**
 * Helper to build a minimal ID3v2.3 tag buffer with the given frames.
 * Each frame: { id: string (4 chars), data: Uint8Array }
 */
function buildID3v23(...frames: { id: string; data: Uint8Array }[]): ArrayBuffer {
  // Calculate total frames size
  let framesSize = 0;
  for (const frame of frames) {
    framesSize += 10 + frame.data.length; // 4 id + 4 size + 2 flags + data
  }

  const buffer = new Uint8Array(10 + framesSize);

  // ID3 header
  buffer[0] = 0x49; // 'I'
  buffer[1] = 0x44; // 'D'
  buffer[2] = 0x33; // '3'
  buffer[3] = 3;    // v2.3
  buffer[4] = 0;    // revision
  buffer[5] = 0;    // flags

  // Tag size (synchsafe)
  const size = framesSize;
  buffer[6] = (size >> 21) & 0x7f;
  buffer[7] = (size >> 14) & 0x7f;
  buffer[8] = (size >> 7) & 0x7f;
  buffer[9] = size & 0x7f;

  let offset = 10;
  for (const frame of frames) {
    // Frame ID (4 bytes)
    for (let i = 0; i < 4; i++) buffer[offset + i] = frame.id.charCodeAt(i);
    // Frame size (4 bytes, big-endian, NOT synchsafe for v2.3)
    const s = frame.data.length;
    buffer[offset + 4] = (s >> 24) & 0xff;
    buffer[offset + 5] = (s >> 16) & 0xff;
    buffer[offset + 6] = (s >> 8) & 0xff;
    buffer[offset + 7] = s & 0xff;
    // Frame flags (2 bytes)
    buffer[offset + 8] = 0;
    buffer[offset + 9] = 0;
    // Frame data
    buffer.set(frame.data, offset + 10);
    offset += 10 + frame.data.length;
  }

  return buffer.buffer;
}

/** Build a text frame (encoding byte 0 = Latin-1, then the string). */
function textFrame(id: string, text: string): { id: string; data: Uint8Array } {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const data = new Uint8Array(1 + textBytes.length);
  data[0] = 3; // UTF-8 encoding
  data.set(textBytes, 1);
  return { id, data };
}

/** Build a TXXX frame: encoding(1) + null-terminated description + value. */
function txxxFrame(description: string, value: string): { id: string; data: Uint8Array } {
  const encoder = new TextEncoder();
  const descBytes = encoder.encode(description);
  const valueBytes = encoder.encode(value);
  // encoding(1) + description + null(1) + value
  const data = new Uint8Array(1 + descBytes.length + 1 + valueBytes.length);
  data[0] = 3; // UTF-8 encoding
  data.set(descBytes, 1);
  data[1 + descBytes.length] = 0; // null terminator
  data.set(valueBytes, 1 + descBytes.length + 1);
  return { id: 'TXXX', data };
}

describe('parseID3 — basic frames', () => {
  it('extracts title, artist, album', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Creep'),
      textFrame('TPE1', 'Radiohead'),
      textFrame('TALB', 'Pablo Honey'),
    );
    const result = parseID3(buffer);
    expect(result.title).toBe('Creep');
    expect(result.artist).toBe('Radiohead');
    expect(result.album).toBe('Pablo Honey');
  });

  it('returns empty object for non-ID3 data', () => {
    const buffer = new ArrayBuffer(10);
    expect(parseID3(buffer)).toEqual({});
  });
});

describe('parseID3 — MusicBrainz TXXX frames', () => {
  it('extracts MusicBrainz Release Track Id', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Test'),
      txxxFrame('MusicBrainz Release Track Id', 'abc-123-def'),
    );
    const result = parseID3(buffer);
    expect(result.musicbrainzRecordingId).toBe('abc-123-def');
  });

  it('extracts MusicBrainz Artist Id', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Test'),
      txxxFrame('MusicBrainz Artist Id', 'artist-456'),
    );
    const result = parseID3(buffer);
    expect(result.musicbrainzArtistId).toBe('artist-456');
  });

  it('extracts both MusicBrainz IDs together', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Test'),
      txxxFrame('MusicBrainz Release Track Id', 'rec-id'),
      txxxFrame('MusicBrainz Artist Id', 'art-id'),
    );
    const result = parseID3(buffer);
    expect(result.musicbrainzRecordingId).toBe('rec-id');
    expect(result.musicbrainzArtistId).toBe('art-id');
  });

  it('handles MUSICBRAINZ_TRACKID as alternative description', () => {
    const buffer = buildID3v23(
      txxxFrame('MUSICBRAINZ_TRACKID', 'track-id-alt'),
    );
    const result = parseID3(buffer);
    expect(result.musicbrainzRecordingId).toBe('track-id-alt');
  });

  it('handles MUSICBRAINZ_ARTISTID as alternative description', () => {
    const buffer = buildID3v23(
      txxxFrame('MUSICBRAINZ_ARTISTID', 'artist-id-alt'),
    );
    const result = parseID3(buffer);
    expect(result.musicbrainzArtistId).toBe('artist-id-alt');
  });
});

describe('parseID3 — TSRC (ISRC) frame', () => {
  it('extracts ISRC from TSRC frame', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Test'),
      textFrame('TSRC', 'USAT29900609'),
    );
    const result = parseID3(buffer);
    expect(result.isrc).toBe('USAT29900609');
  });
});

describe('parseID3 — combined extraction', () => {
  it('extracts all fields from a fully tagged file', () => {
    const buffer = buildID3v23(
      textFrame('TIT2', 'Creep'),
      textFrame('TPE1', 'Radiohead'),
      textFrame('TALB', 'Pablo Honey'),
      textFrame('TSRC', 'GBAYE9300107'),
      txxxFrame('MusicBrainz Release Track Id', 'rec-creep'),
      txxxFrame('MusicBrainz Artist Id', 'art-radiohead'),
    );
    const result = parseID3(buffer);
    expect(result.title).toBe('Creep');
    expect(result.artist).toBe('Radiohead');
    expect(result.album).toBe('Pablo Honey');
    expect(result.isrc).toBe('GBAYE9300107');
    expect(result.musicbrainzRecordingId).toBe('rec-creep');
    expect(result.musicbrainzArtistId).toBe('art-radiohead');
  });
});
