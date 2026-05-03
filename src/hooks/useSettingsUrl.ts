import { useEffect, useState } from 'react';

/**
 * `?settings=<section>` URL state for Settings v2 deep-linking.
 *
 * Returns the current value of the `settings` query param (e.g. `"open"`,
 * `"appearance"`, or `null` when absent).
 *
 * `setSection` writes via `history.pushState` so the browser back-button
 * navigates back to the previous state. `replaceState` is intentionally
 * avoided — it is reserved for OAuth/cleanup callsites:
 *   - `App.tsx:141` (OAuth state cleanup)
 *   - `services/spotify/auth.ts:247,254` (Spotify callback cleanup)
 *   - `AudioPlayer.tsx:395` (`?playlist=` auto-select cleanup)
 *
 * Subscribes to `popstate` so browser back/forward propagates into React state.
 * Call `window.dispatchEvent(new PopStateEvent('popstate'))` after any
 * programmatic `pushState`/`replaceState` mutation to keep the hook in sync.
 *
 * SSR-safe: returns `null` during a render where `window` is undefined
 * (mirrors `useUiV2.ts:16` structure).
 */
export function useSettingsUrl(): [string | null, (section: string | null) => void] {
  const [section, setSection] = useState<string | null>(() => readSection());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (): void => {
      setSection(readSection());
    };

    // pushState/replaceState do not fire popstate natively — only browser
    // back/forward navigation triggers this listener. Programmatic URL
    // mutations need window.dispatchEvent(new PopStateEvent('popstate')).
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (nextSection: string | null): void => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (nextSection === null) {
      params.delete('settings');
    } else {
      params.set('settings', nextSection);
    }

    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.pushState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return [section, navigate];
}

function readSection(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('settings');
}
