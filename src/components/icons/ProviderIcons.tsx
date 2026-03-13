interface ProviderIconProps {
  size?: number;
  color?: string;
}

export const SpotifyIcon = ({ size = 16, color = '#1DB954' }: ProviderIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Spotify"
    role="img"
  >
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 01-.857.208c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.808-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.856zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.45-1.493c3.632-1.102 8.147-.568 11.23 1.33a.78.78 0 01.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.793c3.543-1.073 9.431-.866 13.157 1.308a.937.937 0 01-.997 1.642z" />
  </svg>
);

export const DropboxIcon = ({ size = 16, color = '#0061FF' }: ProviderIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Dropbox"
    role="img"
  >
    <path d="M6 2L1 5.5 6 9l5-3.5L6 2zM18 2l-5 3.5L18 9l5-3.5L18 2zM1 12.5L6 16l5-3.5-5-3.5-5 3.5zM18 9l-5 3.5 5 3.5 5-3.5L18 9zM6 17.5L11 21l5-3.5-5-3.5-5 3.5z" />
  </svg>
);
