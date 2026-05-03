import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * `?ui=v2` flag — opt-in mechanism for whole-screen redesigns shipped behind
 * a feature gate.
 *
 * Returns `true` when ANY of these signals is on:
 *   - `import.meta.env.VITE_UI_V2 === 'true'` (build-time opt-in), OR
 *   - the current URL contains `?ui=v2` (per-session opt-in via query string), OR
 *   - the `vorbis-player-settings-v2-enabled` localStorage key is `true`
 *     (cross-session persistence — set by the "Keep v2 enabled" toggle in
 *     `SettingsV2/sections/AdvancedSection.tsx`, #1452).
 *
 * The OR is one-way: any signal flips the gate on, and there is no URL-based
 * opt-out (the persistence toggle owns the off path).
 *
 * Subscribes to `popstate` so SPA navigation that changes the query string
 * re-evaluates the flag without a full page reload, and to `storage` so
 * cross-tab toggles propagate.
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

    const handleStorage = (event: StorageEvent): void => {
      if (event.key === STORAGE_KEYS.SETTINGS_V2_ENABLED) {
        setEnabled(readFlag());
      }
    };

    // pushState/replaceState do not fire popstate natively — only browser
    // back/forward navigation triggers this listener. Programmatic URL
    // mutations need window.dispatchEvent(new PopStateEvent('popstate')).
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return enabled;
}

function readFlag(): boolean {
  if (import.meta.env.VITE_UI_V2 === 'true') return true;
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('ui') === 'v2') return true;
  return readPersistedFlag();
}

function readPersistedFlag(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SETTINGS_V2_ENABLED);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}
