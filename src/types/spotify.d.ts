/**
 * @fileoverview Spotify and Local Music Type Definitions
 * 
 * Comprehensive type definitions for the Vorbis Player application,
 * supporting both Spotify Web Playback SDK integration and local music
 * library management. Provides unified interfaces for cross-platform
 * music playback.
 * 
 * @architecture
 * This file defines the core data structures used throughout the application:
 * - Spotify Web Playback SDK interfaces
 * - Local music library types
 * - Enhanced unified track interface
 * - Database and API response types
 * 
 * @relationships
 * - SpotifyTrack: Base interface for Spotify track data
 * - LocalTrack: Detailed interface for local music metadata
 * - EnhancedTrack: Unified interface extending SpotifyTrack with local properties
 * - SpotifyPlaybackState: Real-time playback state from Spotify SDK
 * 
 * @usage
 * ```typescript
 * import type { EnhancedTrack, LocalTrack, SpotifyTrack } from './types/spotify';
 * 
 * // Use unified track interface for any music source
 * const track: EnhancedTrack = {
 *   id: 'spotify:track:123',
 *   name: 'Song Title',
 *   source: 'spotify',
 *   // ... other properties
 * };
 * ```
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }

  interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    getCurrentState(): Promise<SpotifyPlaybackState | null>;
    getVolume(): Promise<number>;
    nextTrack(): Promise<void>;
    pause(): Promise<void>;
    previousTrack(): Promise<void>;
    resume(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    setName(name: string): Promise<void>;
    setVolume(volume: number): Promise<void>;
    togglePlay(): Promise<void>;
    
    addListener(event: 'ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'initialization_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'authentication_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'account_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'playback_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'player_state_changed', callback: (state: SpotifyPlaybackState | null) => void): void;
    
    removeListener(event: string, callback?: (...args: unknown[]) => void): void;
  }

  interface SpotifyPlaybackState {
    context: {
      uri: string;
      metadata: Record<string, unknown>;
    };
    disallows: {
      pausing: boolean;
      peeking_next: boolean;
      peeking_prev: boolean;
      resuming: boolean;
      seeking: boolean;
      skipping_next: boolean;
      skipping_prev: boolean;
    };
    paused: boolean;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: {
      current_track: SpotifyTrack;
      next_tracks: SpotifyTrack[];
      previous_tracks: SpotifyTrack[];
    };
  }

  interface SpotifyTrack {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: Array<{
      name: string;
      uri: string;
    }>;
    album: {
      name: string;
      uri: string;
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    };
  }
}

export {};