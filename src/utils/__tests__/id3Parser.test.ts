import { describe, it, expect } from 'vitest';
import { parseID3 } from '../id3Parser';

// ============================================================
// HELPERS — build minimal binary buffers for each tag version
// ============================================================

/** Encode a latin-1 string into bytes. */
function latin1(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

/** Build a synchsafe integer (4 bytes). */
function synchsafe(n: number): number[] {
  return [
    (n >> 21) & 0x7f,
    (n >> 14) & 0x7f,
    (n >> 7) & 0x7f,
    n & 0x7f,
  ];
}

/** Build a big-endian uint32. */
function uint32BE(n: number): number[] {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Build a big-endian uint24. */
function uint24BE(n: number): number[] {
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Build a little-endian uint32. */
function uint32LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

/**
 * Build a minimal ID3v2.3 tag with one text frame.
 * @param frameId  4-char frame ID (e.g. 'TYER', 'TDRC')
 * @param text     text value
 * @param version  major version (3 or 4)
 */
function buildID3v2Tag(frameId: string, text: string, version: 3 | 4 = 3): ArrayBuffer {
  // Text frame payload: encoding byte (0 = ISO-8859-1) + text + null
  const textBytes = [0, ...latin1(text), 0];
  const frameIdBytes = latin1(frameId);
  const frameSize = version === 4 ? synchsafe(textBytes.length) : uint32BE(textBytes.length);
  const frameFlags = [0, 0];

  const frameData = [...frameIdBytes, ...frameSize, ...frameFlags, ...textBytes];

  // ID3 header
  const tagSize = synchsafe(frameData.length);
  const header = [
    0x49, 0x44, 0x33, // "ID3"
    version,          // major version
    0,                // revision
    0,                // flags
    ...tagSize,
  ];

  return new Uint8Array([...header, ...frameData]).buffer;
}

/**
 * Build a minimal ID3v2.2 tag with one text frame.
 */
function buildID3v22Tag(frameId: string, text: string): ArrayBuffer {
  const textBytes = [0, ...latin1(text), 0];
  const frameIdBytes = latin1(frameId);
  const frameSize = uint24BE(textBytes.length);

  const frameData = [...frameIdBytes, ...frameSize, ...textBytes];

  const tagSize = synchsafe(frameData.length);
  const header = [
    0x49, 0x44, 0x33, // "ID3"
    2,                // major version = 2
    0,                // revision
    0,                // flags
    ...tagSize,
  ];

  return new Uint8Array([...header, ...frameData]).buffer;
}

/**
 * Build a minimal FLAC file with a VORBIS_COMMENT block containing given comments.
 */
function buildFlacWithComments(comments: string[]): ArrayBuffer {
  // Vorbis comment block:
  // vendor string (length + data) + comment count + each comment (length + data)
  const vendorStr = latin1('test');
  const vendorLen = uint32LE(vendorStr.length);
  const commentCount = uint32LE(comments.length);

  const commentBytes: number[] = [];
  for (const c of comments) {
    const cBytes = latin1(c);
    commentBytes.push(...uint32LE(cBytes.length), ...cBytes);
  }

  const blockBody = [...vendorLen, ...vendorStr, ...commentCount, ...commentBytes];

  // Metadata block header: type 4 (VORBIS_COMMENT), last block flag set
  const blockHeader = [
    0x80 | 4, // isLast=true, blockType=4
    ...uint24BE(blockBody.length),
  ];

  const flacMagic = [0x66, 0x4c, 0x61, 0x43]; // "fLaC"
  return new Uint8Array([...flacMagic, ...blockHeader, ...blockBody]).buffer;
}

// ============================================================
// TESTS
// ============================================================

describe('parseID3 — release year extraction', () => {
  describe('ID3v2.3 — TYER frame', () => {
    it('extracts year from TYER frame', () => {
      const buffer = buildID3v2Tag('TYER', '1982', 3);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(1982);
    });

    it('extracts year from TYER frame with trailing whitespace', () => {
      const buffer = buildID3v2Tag('TYER', '1995 ', 3);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(1995);
    });
  });

  describe('ID3v2.4 — TDRC frame', () => {
    it('extracts year from TDRC with full date (YYYY-MM-DD)', () => {
      const buffer = buildID3v2Tag('TDRC', '2013-05-17', 4);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(2013);
    });

    it('extracts year from TDRC with year only', () => {
      const buffer = buildID3v2Tag('TDRC', '2020', 4);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(2020);
    });

    it('extracts year from TDRC with year-month', () => {
      const buffer = buildID3v2Tag('TDRC', '2001-11', 4);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(2001);
    });
  });

  describe('ID3v2.2 — TYE frame', () => {
    it('extracts year from TYE frame', () => {
      const buffer = buildID3v22Tag('TYE', '1969');
      const result = parseID3(buffer);
      expect(result.releaseYear).toBe(1969);
    });
  });

  describe('FLAC — DATE vorbis comment', () => {
    it('extracts year from DATE comment', () => {
      // #when
      const buffer = buildFlacWithComments(['DATE=2023-01-15']);
      const result = parseID3(buffer);

      // #then
      expect(result.releaseYear).toBe(2023);
    });

    it('extracts year from YEAR comment', () => {
      // #when
      const buffer = buildFlacWithComments(['YEAR=1987']);
      const result = parseID3(buffer);

      // #then
      expect(result.releaseYear).toBe(1987);
    });

    it('extracts year from DATE with year only', () => {
      // #when
      const buffer = buildFlacWithComments(['DATE=2005']);
      const result = parseID3(buffer);

      // #then
      expect(result.releaseYear).toBe(2005);
    });

    it('also extracts title and artist alongside DATE', () => {
      // #given
      const buffer = buildFlacWithComments([
        'TITLE=Test Song',
        'ARTIST=Test Artist',
        'DATE=2019',
      ]);

      // #when
      const result = parseID3(buffer);

      // #then
      expect(result.releaseYear).toBe(2019);
      expect(result.title).toBe('Test Song');
      expect(result.artist).toBe('Test Artist');
    });
  });

  describe('edge cases', () => {
    it('returns undefined releaseYear when no date frame is present', () => {
      const buffer = buildID3v2Tag('TIT2', 'Just a title', 3);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBeUndefined();
    });

    it('returns undefined releaseYear for malformed date string', () => {
      const buffer = buildID3v2Tag('TYER', 'abcd', 3);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBeUndefined();
    });

    it('returns undefined releaseYear for empty date string', () => {
      const buffer = buildID3v2Tag('TYER', '', 3);
      const result = parseID3(buffer);
      expect(result.releaseYear).toBeUndefined();
    });

    it('returns undefined releaseYear for non-ID3 buffer', () => {
      const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]).buffer;
      const result = parseID3(buffer);
      expect(result.releaseYear).toBeUndefined();
    });

    it('FLAC: returns undefined releaseYear when DATE is malformed', () => {
      // #when
      const buffer = buildFlacWithComments(['DATE=not-a-date']);
      const result = parseID3(buffer);

      // #then
      expect(result.releaseYear).toBeUndefined();
    });
  });
});
