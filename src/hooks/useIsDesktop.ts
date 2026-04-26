import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 700px)';

/**
 * Returns `true` when the viewport matches the desktop breakpoint
 * (>= 700px). Subscribes to `matchMedia` `change` events so the value
 * stays in sync as the viewport resizes.
 *
 * SSR-safe: returns `false` during a render where `window` is undefined.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setIsDesktop(event.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return isDesktop;
}
