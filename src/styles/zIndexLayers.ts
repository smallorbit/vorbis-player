/**
 * Numeric z-index layers for inline style overrides and shadcn primitives.
 * `theme.zIndex` string values are derived from these — import here for
 * dialog/sheet/toast/popover overrides instead of duplicating literals.
 */
const MODAL_BASE = 1400;

export const Z_INDEX_LAYERS = {
  modal: MODAL_BASE,
  dialogOverlay: MODAL_BASE + 4,
  dialogContent: MODAL_BASE + 5,
  sheet: MODAL_BASE + 10,
  toast: MODAL_BASE + 10,
  popover: 1500,
} as const;

export const DIALOG_OVERLAY_Z_INDEX = Z_INDEX_LAYERS.dialogOverlay;
export const DIALOG_Z_INDEX = Z_INDEX_LAYERS.dialogContent;
export const SHEET_Z_INDEX = Z_INDEX_LAYERS.sheet;
export const TOAST_Z_INDEX = Z_INDEX_LAYERS.toast;
export const POPOVER_Z_INDEX = Z_INDEX_LAYERS.popover;
