import TrackInfoPopover from './TrackInfoPopover';
import { RadioIcon } from '../icons/QuickActionIcons';

export interface TrackRadioPopoverProps {
  trackName: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onPlayRadio: () => void;
}

export function TrackRadioPopover({
  trackName,
  anchorRect,
  onClose,
  onPlayRadio,
}: TrackRadioPopoverProps): JSX.Element {
  return (
    <TrackInfoPopover
      type="radio"
      anchorRect={anchorRect}
      onClose={onClose}
      options={[
        {
          label: `Play ${trackName} Radio`,
          icon: <RadioIcon />,
          onClick: onPlayRadio,
        },
      ]}
    />
  );
}

export default TrackRadioPopover;
