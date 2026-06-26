import { Toaster as Sonner } from 'sonner';
import { theme } from '@/styles/theme';

/**
 * Toaster wrapper — mounts at app root.
 *
 * - z-index 1410: clears BottomBar (theme.zIndex.modal = 1400) and Dialog overlay (1405).
 *   Matches the prior hand-rolled Toast.tsx (`theme.zIndex.modal + 10`).
 * - position="bottom-center": toasts rise from the bottom (issue #1664). The bottom offset
 *   reads `--vp-toast-offset`, a variable the BottomBar publishes on `:root` while it is
 *   visible (see `BottomBar/index.tsx`). When the bar is absent the variable is unset and
 *   the `var()` fallback (sonner's default viewport offset) keeps the toast near the bottom
 *   edge. This keeps toasts clear of the interactive bottom bar without wiring BottomBar
 *   context up to this app-root component.
 * - theme="dark": app is dark-mode-only.
 * - Surface uses neutral player-chrome tokens (overlay.dark + popover.border) — never
 *   the runtime --accent-color, per the shadcn coexistence rule in CLAUDE.md.
 *
 * Sonner v2.0.7 reads `--z-index` from inline style on the Toaster root.
 */
export function Toaster(): React.ReactElement {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={{ bottom: 'var(--vp-toast-offset, 24px)' }}
      mobileOffset={{ bottom: 'var(--vp-toast-offset, 16px)' }}
      closeButton
      toastOptions={{
        style: {
          background: theme.colors.overlay.dark,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${theme.colors.popover.border}`,
          borderRadius: theme.borderRadius['2xl'],
          color: theme.colors.white,
          fontSize: theme.fontSize.sm,
          maxWidth: `min(460px, calc(100vw - ${theme.spacing.lg} * 2))`,
        },
        actionButtonStyle: {
          background: 'transparent',
          color: theme.colors.primary,
          fontWeight: 600,
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          padding: 0,
          border: 'none',
          cursor: 'pointer',
        },
      }}
      style={{ '--z-index': '1410' } as React.CSSProperties}
    />
  );
}
