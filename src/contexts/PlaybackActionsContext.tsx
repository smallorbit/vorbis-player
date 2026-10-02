import React, { createContext, useContext } from 'react';

export interface PlaybackActionsValue {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExpand: () => void;
  onStartRadio?: (() => void) | undefined;
}

const PlaybackActionsContext = createContext<PlaybackActionsValue | null>(null);

interface PlaybackActionsProviderProps {
  value: PlaybackActionsValue;
  children: React.ReactNode;
}

export function PlaybackActionsProvider({ value, children }: PlaybackActionsProviderProps) {
  return (
    <PlaybackActionsContext.Provider value={value}>
      {children}
    </PlaybackActionsContext.Provider>
  );
}

export function usePlaybackActions(): PlaybackActionsValue {
  const ctx = useContext(PlaybackActionsContext);
  if (!ctx) {
    throw new Error('usePlaybackActions must be used within PlaybackActionsProvider');
  }
  return ctx;
}

/** No-op actions for empty-state LibraryRoute mounts (PlayerStateRenderer). */
export const noopPlaybackActions: PlaybackActionsValue = {
  onPlay: () => {},
  onPause: () => {},
  onNext: () => {},
  onPrevious: () => {},
  onExpand: () => {},
};
