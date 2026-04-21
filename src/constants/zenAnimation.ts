/**
 * Zen-mode transition timing contract.
 *
 * Two phases, choreographed so the album art stays visually anchored:
 *
 *   Entry (normal → zen), total ≈ 1300ms:
 *     0–300ms    : controls fade + transform in-place (ZEN_CONTROLS_DURATION);
 *                  grid-template-rows stays 1fr so layout height is stable.
 *     300–1300ms : controls row collapses, PlayerStack max-width grows, and
 *                  ContentWrapper margin-bottom shrinks — all in parallel
 *                  over ZEN_ART_DURATION after ZEN_ART_ENTER_DELAY.
 *     BottomBar auto-hides via the AUTOHIDE_DELAY in BottomBar/index.tsx.
 *
 *   Exit (zen → normal), total ≈ 1300ms:
 *     0–1000ms    : album art shrinks alone (PlayerStack max-width,
 *                   ContentWrapper width) over ZEN_ART_DURATION. Controls
 *                   wrapper stays collapsed; BottomBar stays hidden.
 *     1000–1300ms : after ZEN_EXIT_REENTRY_DELAY, controls row expands,
 *                   opacity/transform restore, ContentWrapper margin-bottom
 *                   grows to BOTTOM_BAR_HEIGHT, and BottomBar slides in —
 *                   all over ZEN_CONTROLS_DURATION / ZEN_BAR_DURATION.
 *
 * The transition is gated by a short-lived $zenTransitioning flag on
 * PlayerStack so viewport-driven resizes stay instantaneous. BottomBar
 * uses a $zenExiting flag to delay its slide-in only on the zen-exit edge
 * — normal hover/touch reveals remain snappy. prefers-reduced-motion is
 * honored on PlayerStack, ZenControlsWrapper, and BottomBarContainer
 * (their transitions collapse to `none`). ContentWrapper's width and
 * margin-bottom transitions are not gated by the media query and still
 * animate under reduced motion.
 */
export const ZEN_ART_DURATION = 1000;
export const ZEN_ART_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const ZEN_ART_ENTER_DELAY = 300;

export const ZEN_CONTROLS_DURATION = 300;
/**
 * Delay before bottom bar / controls begin re-entering on zen → normal exit.
 * Matches ZEN_ART_DURATION so the album art finishes shrinking before controls
 * and the bottom bar reappear, preventing the parent flex from re-centering
 * mid-shrink. See orchestration notes in PlayerContent/styled.ts.
 */
export const ZEN_EXIT_REENTRY_DELAY = ZEN_ART_DURATION;

export const ZEN_ART_MARGIN_H = 96;
export const ZEN_ART_MARGIN_V = 196;
export const ZEN_ART_MARGIN_H_MOBILE = 32;
export const ZEN_ART_MARGIN_V_MOBILE = 120;

export const ZEN_BAR_DURATION = 300;

export const ZEN_TRACK_INFO_ENTER_OPACITY_DURATION = 600;
export const ZEN_TRACK_INFO_ENTER_OPACITY_DELAY = 800;
export const ZEN_TRACK_INFO_ENTER_HEIGHT_DURATION = 300;
export const ZEN_TRACK_INFO_ENTER_HEIGHT_DELAY = 300;
export const ZEN_TRACK_INFO_EXIT_DURATION = 200;

export const ZEN_DEAD_ZONE_TOP = 0.2;
export const ZEN_DEAD_ZONE_BOTTOM = 0.8;
export const ZEN_ZONE_LEFT_BOUNDARY = 0.25;
export const ZEN_ZONE_RIGHT_BOUNDARY = 0.75;

export type Zone = 'left' | 'center' | 'right';

export function resolveZenZone(clientX: number, clientY: number, rect: DOMRect): Zone | null {
  const relY = (clientY - rect.top) / rect.height;
  if (relY < ZEN_DEAD_ZONE_TOP || relY > ZEN_DEAD_ZONE_BOTTOM) return null;
  const relX = (clientX - rect.left) / rect.width;
  if (relX < ZEN_ZONE_LEFT_BOUNDARY) return 'left';
  if (relX > ZEN_ZONE_RIGHT_BOUNDARY) return 'right';
  return 'center';
}
