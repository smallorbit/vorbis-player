import React from 'react';
import {
  PlaybackActionsProvider,
  noopPlaybackActions,
  type PlaybackActionsValue,
} from '@/contexts/PlaybackActionsContext';

export function withPlaybackActions(
  ui: React.ReactElement,
  value: PlaybackActionsValue = noopPlaybackActions,
): React.ReactElement {
  return <PlaybackActionsProvider value={value}>{ui}</PlaybackActionsProvider>;
}
