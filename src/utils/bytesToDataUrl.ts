/** Convert a Uint8Array to a base64 data URL string. Chunks the conversion to avoid stack overflow. */
export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
