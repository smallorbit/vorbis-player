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

export function parseID3(buffer: ArrayBuffer): AudioMetadata {
  const bytes = new Uint8Array(buffer);

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
        else if (frameId === 'PIC' && !result.coverArt) {
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
        else if (frameId === 'APIC' && !result.coverArt) {
          const apic = decodeAPIC(data);
          if (apic) result.coverArt = apic;
        }
      }
      offset += frameSize;
    }
  }

  return result;
}
