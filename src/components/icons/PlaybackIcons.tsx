import { IconSvg, type IconProps } from './Icon';

export function PreviousIcon(props: IconProps = {}) {
  return (
    <IconSvg fill="currentColor" {...props}>
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </IconSvg>
  );
}

export function PlayIcon({ fill = 'currentColor', ...props }: IconProps = {}) {
  return (
    <IconSvg fill={fill} {...props}>
      <path d="M8 5v14l11-7z" />
    </IconSvg>
  );
}

export function PauseIcon(props: IconProps = {}) {
  return (
    <IconSvg fill="currentColor" {...props}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </IconSvg>
  );
}

export function NextIcon(props: IconProps = {}) {
  return (
    <IconSvg fill="currentColor" {...props}>
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </IconSvg>
  );
}
