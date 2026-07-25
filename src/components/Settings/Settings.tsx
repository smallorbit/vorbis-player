import React, { useCallback, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { useSettingsUrl } from '@/hooks/useSettingsUrl';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';
import { SettingsMobileTakeover } from './SettingsMobileTakeover';
import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSectionId,
  type SettingsSectionId,
} from './sections';
import { Overlay, DesktopShell, MobileTakeover } from './styled';

/** Sentinel for "show the mobile list view". Uses `__list` (not a valid URL param value) to avoid colliding with `?settings=open` deep-links. */
const MOBILE_LIST_VIEW = '__list';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings v2 shell.
 *
 * The primary settings surface — mounted unconditionally by the entry-point
 * forks in `AudioPlayer.tsx` and `PlayerControlsSection.tsx`.
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
 *   - Shift+S — already routed through `setIsSettingsOpen(prev => !prev)`
 *     by `useKeyboardShortcuts.ts`; flipping the parent's `isOpen` prop
 *     is sufficient.
 */
export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useSettingsUrl();
  const { isMobile } = usePlayerSizingContext();

  const activeSection: SettingsSectionId = isSettingsSectionId(section)
    ? section
    : DEFAULT_SETTINGS_SECTION;

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
  }, [isOpen, onClose]);

  const handleSelectSection = (next: SettingsSectionId): void => {
    setSection(next);
  };

  const validSection = isSettingsSectionId(section) ? section : null;

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
              <SettingsMobileTakeover
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
                <SettingsSidebar activeSection={activeSection} onSelect={handleSelectSection} />
                <SettingsContent activeSection={activeSection} onClose={closeShell} />
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
 * one is missing. The visible heading lives inside `SettingsContent` /
 * `SettingsMobileTakeover`, so render an SR-only title to satisfy the
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

