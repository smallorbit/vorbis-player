import styled from 'styled-components';

/**
 * SettingsV2 chrome — neutral shadcn palette only.
 *
 * Theme-bridge invariant: never wire shadcn `--primary` or `--accent` to
 * `var(--accent-color)` here. The settings shell intentionally stays
 * neutral so it does not retint per playing track. See
 * `docs/architecture/shadcn.md#theme-bridge-accent-color-is-player-chrome-only`.
 *
 * Container queries are the primary responsive strategy; the desktop /
 * mobile-takeover fork itself runs off `usePlayerSizingContext().isMobile`
 * (mirrors `PlayerContent/DrawerOrchestrator.tsx:164-188`).
 *
 * Z-index parity: 1405 matches `DIALOG_Z_INDEX` in `src/components/ui/dialog.tsx`
 * (above `theme.zIndex.modal = 1400` / `BottomBar` max 1350). The overlay
 * sits one level below at 1404. These values are coupled to `dialog.tsx` —
 * the wrappers in `SettingsV2.tsx` are now rendered via Radix Dialog primitives
 * (`asChild`), so visibility/pointer-events/transitions are driven by Radix
 * `data-state` rather than the previous `$isOpen` prop wiring.
 */

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) => theme.colors.overlay.light};
  z-index: 1404;
  opacity: 0;
  transition: opacity ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing};

  &[data-state='open'] {
    opacity: 1;
  }

  &[data-state='closed'] {
    pointer-events: none;
  }
`;

export const DesktopShell = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  width: min(960px, 92vw);
  height: min(640px, 80vh);
  transform: translate(-50%, -50%) scale(0.96);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  z-index: 1405;
  opacity: 0;
  display: grid;
  grid-template-columns: 240px 1fr;
  overflow: hidden;
  transition:
    opacity ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing},
    transform ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing};

  container-type: inline-size;
  container-name: settings-v2;

  &[data-state='open'] {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }

  &[data-state='closed'] {
    pointer-events: none;
  }

  &:focus {
    outline: none;
  }

  @container settings-v2 (max-width: 700px) {
    grid-template-columns: 200px 1fr;
  }
`;

export const MobileTakeover = styled.div`
  position: fixed;
  inset: 0;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  z-index: 1405;
  transform: translateX(100%);
  transition: transform ${({ theme }) => theme.drawer.transitionDuration}ms ${({ theme }) => theme.drawer.transitionEasing};
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);

  &[data-state='open'] {
    transform: translateX(0);
  }

  &[data-state='closed'] {
    pointer-events: none;
  }

  &:focus {
    outline: none;
  }
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid hsl(var(--border));
  min-height: 56px;
  flex-shrink: 0;
`;

export const HeaderTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: hsl(var(--foreground));
`;

export const IconButton = styled.button`
  background: transparent;
  border: none;
  color: hsl(var(--foreground));
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: hsl(var(--muted));
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

export const SidebarRoot = styled.nav`
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  overflow-y: auto;
`;

export const SidebarHeader = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: hsl(var(--foreground));
`;

export const SidebarItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ $active }) => ($active ? 'hsl(var(--muted))' : 'transparent')};
  color: hsl(var(--foreground));
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme, $active }) => ($active ? theme.fontWeight.medium : theme.fontWeight.normal)};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: hsl(var(--muted));
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

export const ContentRoot = styled.section`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--background));
`;

export const ContentBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: hsl(var(--foreground));
`;

export const MobileSectionList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

export const MobileSectionRow = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: transparent;
  border: none;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  text-align: left;
  cursor: pointer;
  min-height: 56px;

  &:hover {
    background: hsl(var(--muted));
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: -2px;
  }
`;

export const MobileChevron = styled.span`
  color: hsl(var(--muted-foreground));
  font-size: 1.25em;
  line-height: 1;
`;

export const MobileDetailBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;
