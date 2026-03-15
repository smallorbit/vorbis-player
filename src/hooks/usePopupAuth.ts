import { useEffect, useState, useCallback } from 'react';
import type { ProviderId } from '@/types/domain';

export const AUTH_STATE_CHANGED_EVENT = 'vorbis-auth-state-changed';

interface AuthEvent {
  provider: ProviderId;
  timestamp: number;
}

export function usePopupAuth(): { lastAuthEvent: AuthEvent | null } {
  const [lastAuthEvent, setLastAuthEvent] = useState<AuthEvent | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'vorbis-auth-complete') return;

    const provider = event.data.provider as ProviderId;
    setLastAuthEvent({ provider, timestamp: Date.now() });

    window.dispatchEvent(
      new CustomEvent(AUTH_STATE_CHANGED_EVENT, { detail: { provider } }),
    );
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return { lastAuthEvent };
}
