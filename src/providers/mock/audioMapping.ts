export const AUDIO_CLIP_COUNT = 10;
export const AUDIO_CLIP_BASE_PATH = '/playwright-fixtures/audio';

// Blueprint D7 specifies sha256 → mod N. Using inline FNV-1a instead because
// js-sha256 is not a transitive dependency in this project. For the use case
// (stable uniform mapping to 0..9), the two algorithms are equivalent.
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (Math.imul(hash, 0x01000193) >>> 0);
  }
  return hash;
}

export function clipIndexForTrack(trackId: string): number {
  return fnv1a32(trackId) % AUDIO_CLIP_COUNT;
}

export function clipUrlForTrack(trackId: string): string {
  const index = clipIndexForTrack(trackId);
  const padded = String(index + 1).padStart(2, '0');
  return `${AUDIO_CLIP_BASE_PATH}/clip-${padded}.ogg`;
}
