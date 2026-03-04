/**
 * MusicKit JS v3 type declarations.
 * Covers only the subset of the API used by Vorbis Player.
 *
 * Uses plain exports (no namespace/enum) for erasableSyntaxOnly compatibility.
 */

export interface MKConfiguration {
  developerToken: string;
  app: { name: string; build: string };
}

export interface MKArtworkDescriptor {
  url: string;
  width?: number;
  height?: number;
  bgColor?: string;
  textColor1?: string;
}

export interface MKMediaItemAttributes {
  name: string;
  artistName: string;
  albumName: string;
  durationInMillis: number;
  artwork?: MKArtworkDescriptor;
  url?: string;
  playParams?: { catalogId?: string; id?: string };
  trackNumber?: number;
}

export interface MKMediaItem {
  id: string;
  type: string;
  attributes: MKMediaItemAttributes;
}

export interface MKResourceRelationship {
  data: MKMediaItem[];
  next?: string;
}

export interface MKLibraryCollection {
  id: string;
  type: string;
  attributes: {
    name: string;
    description?: { standard?: string };
    artwork?: MKArtworkDescriptor;
    trackCount?: number;
    playParams?: { id?: string; catalogId?: string };
  };
  relationships?: {
    tracks?: MKResourceRelationship;
  };
}

export interface MKPaginatedResponse<T> {
  data: T[];
  next?: string;
  meta?: { total?: number };
}

export interface MKMusicAPIResponse<T> {
  data: MKPaginatedResponse<T>;
}

/** MusicKit playback states as numeric constants. */
export const MKPlaybackStates = {
  none: 0,
  loading: 1,
  playing: 2,
  paused: 3,
  stopped: 4,
  ended: 5,
  seeking: 6,
  waiting: 8,
  stalled: 9,
  completed: 10,
} as const;

export type MKPlaybackState = (typeof MKPlaybackStates)[keyof typeof MKPlaybackStates];

export interface MKQueue {
  items: MKMediaItem[];
  length: number;
  position: number;
  currentItem: MKMediaItem | null;
}

export interface MKSetQueueOptions {
  song?: string;
  songs?: string[];
  album?: string;
  playlist?: string;
  url?: string;
  startWith?: number;
  startPlaying?: boolean;
}

export interface MKInstance {
  authorize(): Promise<string>;
  unauthorize(): Promise<void>;
  isAuthorized: boolean;
  musicUserToken: string;
  developerToken: string;

  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seekToTime(time: number): Promise<void>;
  skipToNextItem(): Promise<void>;
  skipToPreviousItem(): Promise<void>;

  volume: number;
  nowPlayingItem: MKMediaItem | null;
  playbackState: MKPlaybackState;
  currentPlaybackTime: number;
  currentPlaybackDuration: number;

  queue: MKQueue;
  setQueue(descriptor: MKSetQueueOptions): Promise<MKQueue>;

  addEventListener(name: string, callback: (...args: unknown[]) => void): void;
  removeEventListener(name: string, callback: (...args: unknown[]) => void): void;

  api: {
    music(path: string, params?: Record<string, unknown>): Promise<MKMusicAPIResponse<unknown>>;
  };
}

/** Shape of the global MusicKit object injected by the SDK script. */
export interface MusicKitGlobal {
  configure(config: MKConfiguration): Promise<MKInstance>;
  getInstance(): MKInstance;
  PlaybackStates: typeof MKPlaybackStates;
  formatArtworkURL(artwork: MKArtworkDescriptor, width: number, height: number): string;
}

declare global {
  interface Window {
    MusicKit?: MusicKitGlobal;
  }
}
