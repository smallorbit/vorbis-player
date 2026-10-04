import { memo, type CSSProperties } from 'react';
import { IconSvg } from './Icon';

const FILLED_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

const OUTLINE_PATH =
  'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z';

const STROKE_PATH =
  'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';

interface MaterialHeartIconProps {
  filled?: boolean | undefined;
  size?: number | string | undefined;
  fill?: string | undefined;
  style?: CSSProperties | undefined;
}

/** Material heart used by the liked-songs pin, zen overlay, and like-button animation. */
export function MaterialHeartIcon({
  filled = true,
  size,
  fill = 'currentColor',
  style,
}: MaterialHeartIconProps = {}) {
  return (
    <IconSvg size={size} fill={fill} style={style}>
      <path d={filled ? FILLED_PATH : OUTLINE_PATH} />
    </IconSvg>
  );
}

/** Stacked outline + filled hearts. LikeButton fades between them with CSS. */
export const AnimatedHeartIcon = memo(function AnimatedHeartIcon() {
  return (
    <span className="heart-icon-wrapper">
      <IconSvg className="heart-outline" role="img">
        <path d={OUTLINE_PATH} />
      </IconSvg>
      <IconSvg className="heart-filled" role="img">
        <path d={FILLED_PATH} />
      </IconSvg>
    </span>
  );
});

interface StrokeHeartIconProps {
  filled?: boolean | undefined;
  size?: number | string | undefined;
}

/** Lucide-style heart for queue rows and the queue context menu. */
export function StrokeHeartIcon({ filled = false, size }: StrokeHeartIconProps = {}) {
  return (
    <IconSvg
      size={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={STROKE_PATH} />
    </IconSvg>
  );
}
