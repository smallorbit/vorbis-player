import TrackInfoPopover from './TrackInfoPopover';
import { RadioIcon } from '../icons/QuickActionIcons';

const DEFAULT_TRUNCATE_LEN = 32;
const DEFAULT_DISABLED_REASON =
  'Radio is unavailable. Configure VITE_LASTFM_API_KEY.';

export function truncateTrackName(name: string, maxLen = DEFAULT_TRUNCATE_LEN): string {
  if (maxLen <= 0) return '';
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen).trimEnd()}…`;
}

export interface TrackRadioPopoverProps {
  trackName: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onPlayRadio: () => void;
  isAvailable?: boolean;
  disabledReason?: string;
}

export function TrackRadioPopover({
  trackName,
  anchorRect,
  onClose,
  onPlayRadio,
  isAvailable = true,
  disabledReason = DEFAULT_DISABLED_REASON,
}: TrackRadioPopoverProps): JSX.Element {
  const truncated = truncateTrackName(trackName);
  const label = `Play ${truncated} Radio`;
  const title = isAvailable ? trackName : disabledReason;

  return (
    <TrackInfoPopover
      type="radio"
      anchorRect={anchorRect}
      onClose={onClose}
      options={[
        {
          label,
          icon: <RadioIcon />,
          onClick: onPlayRadio,
          disabled: !isAvailable,
          title,
        },
      ]}
    />
  );
}

export default TrackRadioPopover;
