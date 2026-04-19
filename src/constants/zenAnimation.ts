export const ZEN_ART_DURATION = 1000;
export const ZEN_ART_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
export const ZEN_ART_ENTER_DELAY = 300;

export const ZEN_CONTROLS_DURATION = 300;
export const ZEN_CONTROLS_EXIT_DELAY = 500;
export const ZEN_CONTROLS_OPACITY_EXIT_DURATION = 700;
export const ZEN_CONTROLS_OPACITY_EXIT_DELAY = 450;
export const ZEN_CONTROLS_TRANSFORM_EXIT_DELAY = 200;

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
