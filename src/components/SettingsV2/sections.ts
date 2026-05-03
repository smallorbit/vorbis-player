/**
 * Section catalog for Settings v2.
 *
 * Phase 1 ships the shell with empty placeholder bodies. Phases 2–4
 * (#1450–#1452 et al) replace each placeholder with real controls;
 * the section IDs and labels stay stable across phases so URL deep-links
 * (`?settings=appearance`) keep working.
 */

export const SETTINGS_V2_SECTION_IDS = ['sources', 'playback', 'appearance', 'advanced'] as const;

export type SettingsV2SectionId = (typeof SETTINGS_V2_SECTION_IDS)[number];

export interface SettingsV2SectionDescriptor {
  id: SettingsV2SectionId;
  label: string;
  description: string;
}

export const SETTINGS_V2_SECTIONS: readonly SettingsV2SectionDescriptor[] = [
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

export const DEFAULT_SETTINGS_V2_SECTION: SettingsV2SectionId = 'sources';

export function isSettingsV2SectionId(value: string | null | undefined): value is SettingsV2SectionId {
  return typeof value === 'string' && (SETTINGS_V2_SECTION_IDS as readonly string[]).includes(value);
}
