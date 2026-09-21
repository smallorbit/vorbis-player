import { AUTH_COMPLETE_EVENT } from '@/constants/events';
import type { ProviderId } from '@/types/domain';

export interface AuthCompletePostMessage {
  type: typeof AUTH_COMPLETE_EVENT;
  provider: ProviderId | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrow popup OAuth `postMessage` payloads from same-origin auth callbacks. */
export function parseAuthCompletePostMessage(data: unknown): AuthCompletePostMessage | null {
  if (!isRecord(data)) return null;
  if (data['type'] !== AUTH_COMPLETE_EVENT) return null;
  const providerRaw = data['provider'];
  const provider = isProviderId(providerRaw) ? providerRaw : null;
  return { type: AUTH_COMPLETE_EVENT, provider };
}

function isProviderId(value: unknown): value is ProviderId {
  return value === 'spotify' || value === 'dropbox';
}
