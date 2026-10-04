import { IconSvg, type IconProps } from './Icon';

const strokeDefaults: IconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function CloseIcon({ size = 16, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} {...strokeDefaults} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </IconSvg>
  );
}

export function MoreVerticalIcon({ size = 16, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="8" cy="3.5" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="12.5" r="1.5" />
    </IconSvg>
  );
}

export function GripIcon({ size = 16, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </IconSvg>
  );
}

export function TrashIcon({ size = 16, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} {...strokeDefaults} {...props}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </IconSvg>
  );
}

export function SaveIcon({ size = 18, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} {...strokeDefaults} {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </IconSvg>
  );
}

export function RetryIcon({ size = 14, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} {...strokeDefaults} {...props}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </IconSvg>
  );
}

export function EyedropperIcon(props: IconProps = {}) {
  return (
    <IconSvg {...strokeDefaults} {...props}>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9" />
      <path d="m15 6 3 3" />
    </IconSvg>
  );
}

export function BugIcon({ size = 22, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} fill="currentColor" {...props}>
      <path d="M20 8h-2.81A5.985 5.985 0 0 0 13 5.07V5a1 1 0 0 0-2 0v.07A5.985 5.985 0 0 0 6.81 8H4a1 1 0 0 0 0 2h2.09A6.011 6.011 0 0 0 6 11v1H4a1 1 0 0 0 0 2h2v1a6.011 6.011 0 0 0 .09 1H4a1 1 0 0 0 0 2h2.81A6 6 0 0 0 18 17v-1h2a1 1 0 0 0 0-2h-2v-1h2a1 1 0 0 0 0-2h-2v-1a6.011 6.011 0 0 0-.09-1H20a1 1 0 0 0 0-2zm-8 9a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
    </IconSvg>
  );
}

export function SettingsGearIcon({ size = 18, ...props }: IconProps = {}) {
  return (
    <IconSvg
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </IconSvg>
  );
}

export function ChevronLeftIcon({ size = 18, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} {...strokeDefaults} {...props}>
      <polyline points="15 18 9 12 15 6" />
    </IconSvg>
  );
}

export function ChevronDownIcon(props: IconProps = {}) {
  return (
    <IconSvg fill="currentColor" {...props}>
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
    </IconSvg>
  );
}

export function LibraryIcon(props: IconProps = {}) {
  return (
    <IconSvg {...strokeDefaults} {...props}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </IconSvg>
  );
}

export function AddToLibraryIcon(props: IconProps = {}) {
  return (
    <IconSvg {...strokeDefaults} {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconSvg>
  );
}

export function RemoveFromLibraryIcon(props: IconProps = {}) {
  return (
    <IconSvg {...strokeDefaults} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </IconSvg>
  );
}

export function AlbumDiscIcon({ size = 24, ...props }: IconProps = {}) {
  return (
    <IconSvg size={size} fill="currentColor" {...props}>
      <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7zm0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </IconSvg>
  );
}

/** Material "radio" device glyph. Distinct from the wave mark in QuickActionIcons. */
export function RadioDeviceIcon(props: IconProps = {}) {
  return (
    <IconSvg fill="currentColor" {...props}>
      <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z" />
    </IconSvg>
  );
}
