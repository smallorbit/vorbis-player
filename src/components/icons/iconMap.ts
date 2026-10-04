import type { FC } from 'react';
import { DiscogsIcon, MusicBrainzIcon } from './BrandIcons';
import type { IconProps } from './Icon';

export const ICON_MAP: Record<string, FC<IconProps>> = {
  discogs: DiscogsIcon,
  musicbrainz: MusicBrainzIcon,
};
