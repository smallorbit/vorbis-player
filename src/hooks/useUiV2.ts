import { useEffect, useState } from 'react';

/**
 * `?ui=v2` flag — opt-in mechanism for whole-screen redesigns shipped behind
 * a feature gate.
 *
 * Returns `true` when EITHER:
 *   - `import.meta.env.VITE_UI_V2 === 'true'` (build-time opt-in), OR
 *   - the current URL contains `?ui=v2` (per-session opt-in via query string).
 *
 * Subscribes to `popstate` so SPA navigation that changes the query string
 * re-evaluates the flag without a full page reload.
 *
 * SSR-safe: returns `false` during a render where `window` is undefined.
 */
export function useUiV2(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readFlag());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (): void => {
      setEnabled(readFlag());
    };

    // pushState/replaceState do not fire popstate natively — only browser
    // back/forward navigation triggers this listener. Programmatic URL
    // mutations need window.dispatchEvent(new PopStateEvent('popstate')).
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return enabled;
}

function readFlag(): boolean {
  if (import.meta.env.VITE_UI_V2 === 'true') return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ui') === 'v2';
}
