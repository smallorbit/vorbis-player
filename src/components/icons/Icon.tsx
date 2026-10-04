import type { CSSProperties, ReactNode } from 'react';

/** Shared props for decorative icons. Size is omitted when a parent stylesheet sizes the svg. */
export interface IconProps {
  size?: number | string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | string | undefined;
  strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit' | undefined;
  strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit' | undefined;
  role?: string | undefined;
  viewBox?: string | undefined;
}

interface IconSvgProps extends IconProps {
  children: ReactNode;
}

export function IconSvg({
  size,
  className,
  style,
  fill,
  stroke,
  strokeWidth,
  strokeLinecap,
  strokeLinejoin,
  role,
  viewBox = '0 0 24 24',
  children,
}: IconSvgProps) {
  return (
    <svg
      viewBox={viewBox}
      aria-hidden="true"
      {...(className !== undefined ? { className } : {})}
      {...(style !== undefined ? { style } : {})}
      {...(size !== undefined ? { width: size, height: size } : {})}
      {...(fill !== undefined ? { fill } : {})}
      {...(stroke !== undefined ? { stroke } : {})}
      {...(strokeWidth !== undefined ? { strokeWidth } : {})}
      {...(strokeLinecap !== undefined ? { strokeLinecap } : {})}
      {...(strokeLinejoin !== undefined ? { strokeLinejoin } : {})}
      {...(role !== undefined ? { role } : {})}
    >
      {children}
    </svg>
  );
}
