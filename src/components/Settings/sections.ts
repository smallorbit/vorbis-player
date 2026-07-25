/**
 * Section catalog for Settings v2.
 *
 * Phase 1 ships the shell with empty placeholder bodies. Phases 2–4
 * (#1450–#1452 et al) replace each placeholder with real controls;
 * the section IDs and labels stay stable across phases so URL deep-links
 * (`?settings=appearance`) keep working.
 */

export const SETTINGS_SECTION_IDS = ['sources', 'playback', 'appearance', 'advanced'] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

interface SettingsSectionDescriptor {
  id: SettingsSectionId;
  label: string;
  description: string;
}

export const SETTINGS_SECTIONS: readonly [SettingsSectionDescriptor, ...SettingsSectionDescriptor[]] = [
  {
    id: 'sources',
    label: 'Sources',
    description: 'Connect Spotify, Dropbox, and other providers. Coming soon.',
  },
  {
    id: 'playback',
    label: 'Playback',
    description: 'Default volume and shuffle behaviour.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Themes, accent colors, and visualizers. Coming soon.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Caches, debug overlays, and developer tools. Coming soon.',
  },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'sources';

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
  return typeof value === 'string' && SETTINGS_SECTION_IDS.some((id) => id === value);
}
