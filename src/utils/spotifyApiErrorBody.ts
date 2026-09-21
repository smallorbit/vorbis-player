function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface SpotifyApiErrorBody {
  message?: string | undefined;
  reason?: string | undefined;
}

export function parseSpotifyApiErrorBody(text: string): SpotifyApiErrorBody | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const errorField = parsed['error'];
  if (!isRecord(errorField)) return null;
  const body: SpotifyApiErrorBody = {};
  const message = errorField['message'];
  if (typeof message === 'string') body.message = message;
  const reason = errorField['reason'];
  if (typeof reason === 'string') body.reason = reason;
  return body;
}
