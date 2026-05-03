import React, { useCallback, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
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
 * Close gestures handled by Radix `Dialog`:
 *   - Esc — Radix emits `onOpenChange(false)` natively
 *   - Overlay click — Radix emits `onOpenChange(false)` natively
 *   - Focus trap + return-to-trigger on close — handled by Radix
 *
 * Close gestures handled by this component:
 *   - Browser back — popstate listener mirrors URL changes from outside
 *     into `onClose()` (Dialog only handles its own internal close, not
 *     the URL state owned by `useSettingsUrl()`).
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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeShell();
    },
    [closeShell],
  );

  /**
   * `AccentColorManager` portals `EyedropperOverlay` to `document.body` so
   * the overlay can cover the entire viewport for pixel picking. That places
   * the overlay outside this Dialog's content tree, so Radix's
   * `DismissableLayer` would otherwise treat clicks on the eyedropper canvas
   * as pointer-down-outside and dismiss the Dialog before the canvas `click`
   * handler fires. The portaled overlay tags itself with
   * `data-eyedropper-overlay="true"` (see `EyedropperOverlay.tsx`); when the
   * dismiss event originates inside that subtree we keep the Dialog open.
   *
   * Mirrors the legacy guard in `PlayerContent/AlbumArtSection.tsx` which
   * uses the same selector to keep the flip-menu open during eyedropper picks.
   */
  const preventDismissOnEyedropper = useCallback((event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('[data-eyedropper-overlay]')) {
      event.preventDefault();
    }
  }, []);

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

  const handleSelectSection = (next: SettingsV2SectionId): void => {
    setSection(next);
  };

  const validSection = isSettingsV2SectionId(section) ? section : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPortal>
        {isMobile ? (
          <DialogPrimitive.Content
            asChild
            aria-label="Settings"
            aria-describedby={undefined}
            onPointerDownOutside={preventDismissOnEyedropper}
            onInteractOutside={preventDismissOnEyedropper}
          >
            <MobileTakeover data-testid="settings-v2-mobile">
              <VisuallyHiddenDialogTitle />
              <SettingsV2MobileTakeover
                activeSection={validSection}
                onSelectSection={handleSelectSection}
                onBackToList={() => setSection(MOBILE_LIST_VIEW)}
                onClose={closeShell}
              />
            </MobileTakeover>
          </DialogPrimitive.Content>
        ) : (
          <>
            <DialogOverlay asChild style={{ zIndex: 1404 }}>
              <Overlay aria-hidden="true" />
            </DialogOverlay>
            <DialogPrimitive.Content
              asChild
              aria-label="Settings"
              aria-describedby={undefined}
              onPointerDownOutside={preventDismissOnEyedropper}
              onInteractOutside={preventDismissOnEyedropper}
            >
              <DesktopShell data-testid="settings-v2-desktop">
                <VisuallyHiddenDialogTitle />
                <SettingsV2Sidebar activeSection={activeSection} onSelect={handleSelectSection} />
                <SettingsV2Content activeSection={activeSection} onClose={closeShell} />
              </DesktopShell>
            </DialogPrimitive.Content>
          </>
        )}
      </DialogPortal>
    </Dialog>
  );
};

/**
 * Radix `Dialog` requires a `Title` for screen readers and warns in dev when
 * one is missing. The visible heading lives inside `SettingsV2Content` /
 * `SettingsV2MobileTakeover`, so render an SR-only title to satisfy the
 * primitive without disturbing the layout.
 */
const VisuallyHiddenDialogTitle: React.FC = () => (
  <DialogPrimitive.Title
    style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    Settings
  </DialogPrimitive.Title>
);

export default SettingsV2;
