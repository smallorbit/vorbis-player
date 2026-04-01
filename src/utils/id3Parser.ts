/**
 * Minimal ID3v2 tag parser for browser environments.
 * Handles ID3v2.2, v2.3, and v2.4 tags with text encodings 0–3.
 * Extracts title, artist, album, and embedded cover art (APIC/PIC frames).
 */

interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  coverArt?: { data: Uint8Array; mimeType: string };
  /** MusicBrainz Recording ID (from TXXX:MusicBrainz Release Track Id). */
  musicbrainzRecordingId?: string;
  /** MusicBrainz Artist ID (from TXXX:MusicBrainz Artist Id). */
  musicbrainzArtistId?: string;
  /** International Standard Recording Code (from TSRC frame). */
  isrc?: string;
  /** Release year extracted from date frames (TDRC/TYER/TYE/DATE). */
  releaseYear?: number;
}

function readSynchsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  );
}

function readUint24BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function decodeTextFrame(data: Uint8Array): string {
  if (data.length === 0) return '';
  const encoding = data[0];
  const raw = data.slice(1);

  let decoded: string;
  if (encoding === 1) {
    decoded = new TextDecoder('utf-16').decode(raw);
  } else if (encoding === 2) {
    decoded = new TextDecoder('utf-16be').decode(raw);
  } else if (encoding === 3) {
    decoded = new TextDecoder('utf-8').decode(raw);
  } else {
    decoded = new TextDecoder('latin1').decode(raw);
  }

  // Strip null characters that can appear at the end of ID3 text frames
  return decoded.replace(/\0/g, '').trim();
}

function skipNullTerminatedString(data: Uint8Array, pos: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    while (pos + 1 < data.length && !(data[pos] === 0 && data[pos + 1] === 0)) pos += 2;
    return pos + 2;
  }
  while (pos < data.length && data[pos] !== 0) pos++;
  return pos + 1;
}

function decodeAPIC(data: Uint8Array): { data: Uint8Array; mimeType: string } | null {
  if (data.length < 4) return null;
  const encoding = data[0];

  let mimeEnd = 1;
  while (mimeEnd < data.length && data[mimeEnd] !== 0) mimeEnd++;
  const mimeType = new TextDecoder('latin1').decode(data.slice(1, mimeEnd)) || 'image/jpeg';

  // Skip past: null terminator + picture type byte, then the description
  const pos = skipNullTerminatedString(data, mimeEnd + 2, encoding);
  if (pos >= data.length) return null;
  return { data: data.slice(pos), mimeType };
}

function decodePIC(data: Uint8Array): { data: Uint8Array; mimeType: string } | null {
  if (data.length < 6) return null;
  const encoding = data[0];
  const format = new TextDecoder('latin1').decode(data.slice(1, 4));

  // Skip past: format (3 bytes) + picture type (1 byte) = offset 5, then description
  const pos = skipNullTerminatedString(data, 5, encoding);
  if (pos >= data.length) return null;
  const mimeType = format.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
  return { data: data.slice(pos), mimeType };
}

/**
 * Decode a TXXX (user-defined text) frame.
 * Format: encoding(1) + null-terminated description + null-terminated value.
 * Returns { description, value } or null on failure.
 */
function decodeTXXX(data: Uint8Array): { description: string; value: string } | null {
  if (data.length < 2) return null;
  const encoding = data[0];

  // Find end of description (null-terminated)
  const descEnd = skipNullTerminatedString(data, 1, encoding);
  if (descEnd >= data.length) return null;

  // Decode description
  const descBytes = data.slice(1, encoding === 1 || encoding === 2 ? descEnd - 2 : descEnd - 1);
  const decoder =
    encoding === 1 ? new TextDecoder('utf-16')
    : encoding === 2 ? new TextDecoder('utf-16be')
    : encoding === 3 ? new TextDecoder('utf-8')
    : new TextDecoder('latin1');

  const description = decoder.decode(descBytes).replace(/\0/g, '').trim();

  // Decode value (rest of the frame)
  const valueBytes = data.slice(descEnd);
  const value = decoder.decode(valueBytes).replace(/\0/g, '').trim();

  return { description, value };
}

/**
 * Extract a 4-digit year from a date string.
 * Handles: "YYYY", "YYYY-MM-DD", "YYYYMMDD", etc.
 */
function extractYearFromDateString(value: string): number | null {
  const match = value.match(/^(\d{4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year > 0 && year < 3000 ? year : null;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function parseFlac(bytes: Uint8Array): AudioMetadata {
  const result: AudioMetadata = {};
  let offset = 4; // skip "fLaC"

  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLength = readUint24BE(bytes, offset + 1);
    offset += 4;

    if (offset + blockLength > bytes.length) break;
    const blockData = bytes.slice(offset, offset + blockLength);
    offset += blockLength;

    if (blockType === 4) {
      // VORBIS_COMMENT block
      let pos = 0;
      if (pos + 4 > blockData.length) break;
      const vendorLen = readUint32LE(blockData, pos);
      pos += 4 + vendorLen;

      if (pos + 4 > blockData.length) break;
      const commentCount = readUint32LE(blockData, pos);
      pos += 4;

      for (let i = 0; i < commentCount && pos + 4 <= blockData.length; i++) {
        const len = readUint32LE(blockData, pos);
        pos += 4;
        if (pos + len > blockData.length) break;
        const comment = new TextDecoder('utf-8').decode(blockData.slice(pos, pos + len));
        pos += len;

        const eqIdx = comment.indexOf('=');
        if (eqIdx < 0) continue;
        const key = comment.slice(0, eqIdx).toUpperCase();
        const value = comment.slice(eqIdx + 1);

        if (key === 'TITLE') result.title = value;
        else if (key === 'ARTIST') result.artist = value;
        else if (key === 'ALBUM') result.album = value;
        else if (key === 'ISRC') result.isrc = value;
        else if (key === 'MUSICBRAINZ_TRACKID') result.musicbrainzRecordingId = value;
        else if (key === 'MUSICBRAINZ_ARTISTID') result.musicbrainzArtistId = value;
        else if ((key === 'DATE' || key === 'YEAR') && !result.releaseYear) {
          const y = extractYearFromDateString(value);
          if (y) result.releaseYear = y;
        }
        else if (key === 'METADATA_BLOCK_PICTURE' && !result.coverArt) {
          try {
            const picBytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
            let p = 0;
            p += 4; // picture type
            const mimeLen = (picBytes[p] << 24) | (picBytes[p+1] << 16) | (picBytes[p+2] << 8) | picBytes[p+3];
            p += 4;
            const mimeType = new TextDecoder('latin1').decode(picBytes.slice(p, p + mimeLen)) || 'image/jpeg';
            p += mimeLen;
            const descLen = (picBytes[p] << 24) | (picBytes[p+1] << 16) | (picBytes[p+2] << 8) | picBytes[p+3];
            p += 4 + descLen + 16; // skip desc + width/height/depth/colors
            const dataLen = (picBytes[p] << 24) | (picBytes[p+1] << 16) | (picBytes[p+2] << 8) | picBytes[p+3];
            p += 4;
            result.coverArt = { data: picBytes.slice(p, p + dataLen), mimeType };
          } catch {
            // malformed picture block — skip
          }
        }
      }
    } else if (blockType === 6 && !result.coverArt) {
      // PICTURE block
      let p = 0;
      p += 4; // picture type
      const mimeLen = readUint32BE(blockData, p); p += 4;
      const mimeType = new TextDecoder('latin1').decode(blockData.slice(p, p + mimeLen)) || 'image/jpeg';
      p += mimeLen;
      const descLen = readUint32BE(blockData, p); p += 4 + descLen + 16;
      const dataLen = readUint32BE(blockData, p); p += 4;
      result.coverArt = { data: blockData.slice(p, p + dataLen), mimeType };
    }

    if (isLast) break;
  }

  return result;
}

export function parseID3(buffer: ArrayBuffer): AudioMetadata {
  const bytes = new Uint8Array(buffer);

  // FLAC: "fLaC"
  if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return parseFlac(bytes);
  }

  // Verify ID3 magic bytes
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const majorVersion = bytes[3];
  const flags = bytes[5];
  const tagSize = readSynchsafeInt(bytes, 6);

  let offset = 10;
  const end = Math.min(10 + tagSize, bytes.length);

  // Skip extended header in v2.3/v2.4 (flags bit 6).
  // In v2.3, extSize does not include the 4-byte size field itself, so add 4.
  // In v2.4, extSize is self-inclusive (synchsafe), so use as-is.
  if (majorVersion >= 3 && flags & 0x40) {
    const extSize =
      majorVersion === 4
        ? readSynchsafeInt(bytes, offset)
        : readUint32BE(bytes, offset);
    offset += majorVersion === 4 ? extSize : extSize + 4;
  }

  const result: AudioMetadata = {};

  if (majorVersion === 2) {
    // ID3v2.2: 3-char IDs, 3-byte sizes, no frame flags
    while (offset + 6 <= end) {
      if (bytes[offset] === 0) break;
      const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
      const frameSize = readUint24BE(bytes, offset + 3);
      offset += 6;

      if (frameSize > 0 && offset + frameSize <= end) {
        const data = bytes.slice(offset, offset + frameSize);
        if (frameId === 'TT2') result.title = decodeTextFrame(data);
        else if (frameId === 'TP1') result.artist = decodeTextFrame(data);
        else if (frameId === 'TAL') result.album = decodeTextFrame(data);
        else if (frameId === 'TYE' && !result.releaseYear) {
          const y = extractYearFromDateString(decodeTextFrame(data));
          if (y) result.releaseYear = y;
        } else if (frameId === 'PIC' && !result.coverArt) {
          const pic = decodePIC(data);
          if (pic) result.coverArt = pic;
        }
      }
      offset += frameSize;
    }
  } else {
    // ID3v2.3 and v2.4: 4-char IDs, 4-byte sizes, 2-byte frame flags
    while (offset + 10 <= end) {
      if (bytes[offset] === 0) break;
      const frameId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
      );
      const frameSize =
        majorVersion === 4
          ? readSynchsafeInt(bytes, offset + 4)
          : readUint32BE(bytes, offset + 4);
      offset += 10;

      if (frameSize > 0 && offset + frameSize <= end) {
        const data = bytes.slice(offset, offset + frameSize);
        if (frameId === 'TIT2') result.title = decodeTextFrame(data);
        else if (frameId === 'TPE1') result.artist = decodeTextFrame(data);
        else if (frameId === 'TALB') result.album = decodeTextFrame(data);
        else if (frameId === 'TSRC') result.isrc = decodeTextFrame(data);
        else if ((frameId === 'TDRC' || frameId === 'TYER') && !result.releaseYear) {
          const y = extractYearFromDateString(decodeTextFrame(data));
          if (y) result.releaseYear = y;
        } else if (frameId === 'APIC' && !result.coverArt) {
          const apic = decodeAPIC(data);
          if (apic) result.coverArt = apic;
        } else if (frameId === 'TXXX') {
          const txxx = decodeTXXX(data);
          if (txxx) {
            const desc = txxx.description.toLowerCase();
            if (desc === 'musicbrainz release track id' || desc === 'musicbrainz_trackid') {
              result.musicbrainzRecordingId = txxx.value;
            } else if (desc === 'musicbrainz artist id' || desc === 'musicbrainz_artistid') {
              result.musicbrainzArtistId = txxx.value;
            }
          }
        }
      }
      offset += frameSize;
    }
  }

  return result;
}
