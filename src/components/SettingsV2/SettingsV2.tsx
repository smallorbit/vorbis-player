import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUiV2 } from '@/hooks/useUiV2';
import { useSettingsUrl } from '@/hooks/useSettingsUrl';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { SettingsV2Sidebar } from './SettingsV2Sidebar';
import { SettingsV2Content } from './SettingsV2Content';
import { SettingsV2MobileTakeover } from './SettingsV2MobileTakeover';
import {
  DEFAULT_SETTINGS_V2_SECTION,
  isSettingsV2SectionId,
  type SettingsV2SectionId,
} from './sections';
import { Overlay, DesktopShell, MobileTakeover } from './styled';

/**
 * `SETTINGS_V2_Z_INDEX = 1405` — sits above the player's `BottomBar`
 * (`theme.zIndex.modal = 1400`) and matches `dialog.tsx`'s `DIALOG_Z_INDEX`
 * (intentionally identical — substitution should be clean when Dialog adoption lands).
 * The overlay renders one level below at `1404`.
 *
 * Inline at the component level mirrors the existing convention used by
 * `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `select.tsx`. There is no
 * project-wide z-index constants file (see `docs/architecture/shadcn.md#z-index-for-shadcn-primitives`).
 */
export const SETTINGS_V2_Z_INDEX = 1405;

/** Sentinel for "show the mobile list view". Uses `__list` (not a valid URL param value) to avoid colliding with `?settings=open` deep-links. */
const MOBILE_LIST_VIEW = '__list';

interface SettingsV2Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings v2 shell — phase 1 scaffold.
 *
 * Mounts when `useUiV2()` is true. Renders nothing otherwise so the
 * parent's legacy `<VisualEffectsMenu />` fallback takes over via the
 * existing entry-point fork in `AudioPlayer.tsx`.
 *
 * Open/close still flows through `useVisualEffectsToggle` (same context
 * the legacy panel uses), so all five entry points (BottomBar gear,
 * Shift+S, ProviderSetupScreen, PlayerStateRenderer, LibraryRoute)
 * keep working unchanged. Section state is layered on top via
 * `useSettingsUrl()` so deep-links (`?settings=appearance`) and the
 * browser back-button work end-to-end.
 *
 * Close gestures handled here:
 *   - Esc — `keydown` listener calls `onClose()`
 *   - Browser back — popstate listener fires `onClose()` when the
 *     `settings` param disappears
 *   - Shift+S — already routed through `setShowVisualEffects(prev => !prev)`
 *     by `useKeyboardShortcuts.ts`; flipping the parent's `isOpen` prop
 *     is sufficient.
 */
export const SettingsV2: React.FC<SettingsV2Props> = ({ isOpen, onClose }) => {
  const uiV2 = useUiV2();
  const [section, setSection] = useSettingsUrl();
  const { isMobile } = usePlayerSizingContext();

  const activeSection: SettingsV2SectionId = isSettingsV2SectionId(section)
    ? section
    : DEFAULT_SETTINGS_V2_SECTION;

  const isSelfClosingRef = useRef(false);

  const closeShell = useCallback(() => {
    isSelfClosingRef.current = true;
    setSection(null);
    onClose();
  }, [setSection, onClose]);

  useEffect(() => {
    if (!uiV2 || !isOpen) return;
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeShell();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uiV2, isOpen, closeShell]);

  useEffect(() => {
    if (!uiV2) return;
    if (typeof window === 'undefined') return;

    const handlePopState = (): void => {
      if (isSelfClosingRef.current) {
        isSelfClosingRef.current = false;
        return;
      }
      const next = new URLSearchParams(window.location.search).get('settings');
      if (next === null && isOpen) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [uiV2, isOpen, onClose]);

  if (!uiV2) return null;
  if (typeof document === 'undefined') return null;
  if (!isOpen) return null;

  const handleSelectSection = (next: SettingsV2SectionId): void => {
    setSection(next);
  };

  const validSection = isSettingsV2SectionId(section) ? section : null;

  const shell = isMobile ? (
    <MobileTakeover
      $isOpen={isOpen}
      $zIndex={SETTINGS_V2_Z_INDEX}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-v2-mobile"
    >
      <SettingsV2MobileTakeover
        activeSection={validSection}
        onSelectSection={handleSelectSection}
        onBackToList={() => setSection(MOBILE_LIST_VIEW)}
        onClose={closeShell}
      />
    </MobileTakeover>
  ) : (
    <>
      <Overlay $isOpen={isOpen} $zIndex={SETTINGS_V2_Z_INDEX} onClick={closeShell} aria-hidden="true" />
      <DesktopShell
        $isOpen={isOpen}
        $zIndex={SETTINGS_V2_Z_INDEX}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-testid="settings-v2-desktop"
      >
        <SettingsV2Sidebar activeSection={activeSection} onSelect={handleSelectSection} />
        <SettingsV2Content activeSection={activeSection} onClose={closeShell} />
      </DesktopShell>
    </>
  );

  return createPortal(shell, document.body);
};

export default SettingsV2;
