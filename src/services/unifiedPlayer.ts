/**
 * @fileoverview Unified Player Service
 * 
 * Central orchestration service that manages playback across multiple sources
 * (Spotify and local music). Provides a unified interface for player controls,
 * state management, and event handling regardless of the music source.
 * 
 * @architecture
 * This service acts as the central coordinator between:
 * - Spotify Web Playback SDK (spotifyPlayer)
 * - Local audio engine (localAudioPlayer)
 * - Database services (enhancedLocalLibraryDatabaseIPC)
 * - UI components (AudioPlayer, SpotifyPlayerControls)
 * 
 * @responsibilities
 * - Unified state management for all playback sources
 * - Event routing and normalization between different audio engines
 * - Queue management and track progression
 * - Volume control and audio settings
 * - Error handling and recovery
 * 
 * @events
 * - playbackStarted: Fired when any track starts playing
 * - playbackPaused: Fired when playback is paused
 * - trackEnded: Fired when a track finishes (triggers auto-advance)
 * - volumeChanged: Fired when volume is adjusted
 * - error: Fired when playback errors occur
 * 
 * @usage
 * ```typescript
 * const player = new UnifiedPlayerService();
 * player.on('playbackStarted', ({ track, source }) => {
 *   console.log(`Playing ${track.name} from ${source}`);
 * });
 * await player.play(track);
 * ```
 * 
 * @dependencies
 * - localAudioPlayer: Local file playback engine
 * - spotifyPlayer: Spotify Web Playback SDK wrapper
 * - enhancedLocalLibraryDatabaseIPC: Database operations
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

import type { LocalTrack, EnhancedTrack } from '../types/spotify.d.ts';
import { localAudioPlayer } from './localAudioPlayer';
import { enhancedLocalLibraryDatabaseIPC } from './enhancedLocalLibraryDatabaseIPC';

/**
 * Playback source identifier
 * 
 * Indicates which audio engine is currently handling playback.
 * Used for routing events and managing state transitions.
 */
export type PlaybackSource = 'spotify' | 'local';

/**
 * Unified player state interface
 * 
 * Centralized state that tracks the current playback status across
 * all music sources. Provides a single source of truth for UI components.
 * 
 * @interface UnifiedPlayerState
 * 
 * @property {EnhancedTrack | null} currentTrack - Currently playing track
 * @property {boolean} isPlaying - Whether audio is currently playing
 * @property {boolean} isPaused - Whether playback is paused
 * @property {number} currentPosition - Current playback position in milliseconds
 * @property {number} duration - Total track duration in milliseconds
 * @property {number} volume - Current volume level (0-1)
 * @property {PlaybackSource | null} source - Active playback source
 * @property {EnhancedTrack[]} queue - Current playback queue
 * @property {number} currentIndex - Index of current track in queue
 */
export interface UnifiedPlayerState {
  currentTrack: EnhancedTrack | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentPosition: number;
  duration: number;
  volume: number;
  source: PlaybackSource | null;
  queue: EnhancedTrack[];
  currentIndex: number;
}

/**
 * UnifiedPlayerService - Central playback orchestration service
 * 
 * Manages playback across multiple music sources (Spotify and local files)
 * with unified state management and event handling. Provides a consistent
 * API regardless of the underlying audio engine.
 * 
 * @class
 * 
 * @example
 * ```typescript
 * const player = new UnifiedPlayerService();
 * 
 * // Play a track from any source
 * await player.play(track);
 * 
 * // Listen for playback events
 * player.on('playbackStarted', ({ track, source }) => {
 *   console.log(`Now playing: ${track.name} from ${source}`);
 * });
 * 
 * // Control playback
 * await player.pause();
 * await player.resume();
 * await player.seek(30000); // Seek to 30 seconds
 * ```
 * 
 * @state
 * - state: Internal player state
 * - listeners: Event listener registry
 * 
 * @methods
 * - play(track): Start playback of a track
 * - pause(): Pause current playback
 * - resume(): Resume paused playback
 * - stop(): Stop playback completely
 * - seek(position): Seek to position in current track
 * - setVolume(volume): Adjust playback volume
 * - next(): Play next track in queue
 * - previous(): Play previous track in queue
 * - on(event, callback): Register event listener
 * - off(event, callback): Remove event listener
 * 
 * @events
 * - playbackStarted: Track started playing
 * - playbackPaused: Playback was paused
 * - playbackStopped: Playback was stopped
 * - trackEnded: Track finished playing
 * - volumeChanged: Volume was adjusted
 * - seeked: Playback position changed
 * - error: Playback error occurred
 * - durationChanged: Track duration updated
 */
export class UnifiedPlayerService {
  private state: UnifiedPlayerState = {
    currentTrack: null,
    isPlaying: false,
    isPaused: false,
    currentPosition: 0,
    duration: 0,
    volume: 0.5,
    source: null,
    queue: [],
    currentIndex: -1
  };

  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor() {
    this.setupLocalPlayerListeners();
    this.setupSpotifyPlayerListeners();
    this.loadVolume();
  }

  /**
   * Sets up event listeners for local audio player
   * 
   * Routes local audio player events to unified event system
   * and updates internal state accordingly.
   * 
   * @private
   */
  private setupLocalPlayerListeners(): void {
    localAudioPlayer.on('trackLoaded', ({ duration }) => {
      this.state.duration = duration;
      this.emit('durationChanged', { duration });
    });

    localAudioPlayer.on('playbackStarted', ({ track }) => {
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.source = 'local';
      this.emit('playbackStarted', { track, source: 'local' });
    });

    localAudioPlayer.on('playbackPaused', ({ track, position }) => {
      this.state.isPlaying = false;
      this.state.isPaused = true;
      this.state.currentPosition = position;
      this.emit('playbackPaused', { track, position, source: 'local' });
    });

    localAudioPlayer.on('playbackStopped', ({ track }) => {
      this.state.isPlaying = false;
      this.state.isPaused = false;
      this.state.currentPosition = 0;
      this.emit('playbackStopped', { track, source: 'local' });
    });

    localAudioPlayer.on('trackEnded', async ({ track }) => {
      console.log('🎵 trackEnded event triggered:', { trackName: track?.name, trackId: track?.id });
      this.state.isPlaying = false;
      
      // Update play count for local tracks
      if (track && track.id) {
        await enhancedLocalLibraryDatabaseIPC.updatePlayCount(track.id);
      }
      
      // Auto-advance to next track
      console.log('🎵 Auto-advancing to next track...');
      await this.next();
      
      this.emit('trackEnded', { track, source: 'local' });
    });

    localAudioPlayer.on('volumeChanged', ({ volume }) => {
      this.state.volume = volume;
      this.saveVolume();
      this.emit('volumeChanged', { volume });
    });

    localAudioPlayer.on('seeked', ({ track, position }) => {
      this.state.currentPosition = position;
      this.emit('seeked', { track, position, source: 'local' });
    });

    localAudioPlayer.on('error', ({ error, track }) => {
      this.emit('error', { error, track, source: 'local' });
    });
  }

  /**
   * Sets up event listeners for Spotify player
   * 
   * Routes Spotify Web Playback SDK events to unified event system
   * and updates internal state accordingly.
   * 
   * @private
   */
  private setupSpotifyPlayerListeners(): void {
    // Note: Spotify player listeners would be set up here
    // For now, we'll integrate with existing Spotify functionality
  }

  async loadTrack(track: EnhancedTrack, autoPlay = false): Promise<void> {
    console.log('🎵 loadTrack called:', { trackName: track.name, autoPlay });
    try {
      // Stop current playback to prevent audio conflicts
      // This ensures clean state transition between different audio sources
      await this.stop();
      
      // Update internal state with new track information
      // This maintains consistency between UI and playback state
      this.state.currentTrack = track;
      
      // Route track loading based on source type
      // Different audio engines require different initialization approaches
      if (track.source === 'local') {
        const localTrack = track as LocalTrack;
        // Load track into local audio player for file-based playback
        // This handles local file system access and audio decoding
        await localAudioPlayer.loadTrack(localTrack);
        this.state.source = 'local';
      } else {
        // Handle Spotify track loading through Web Playback SDK
        // This integrates with Spotify's streaming service
        this.state.source = 'spotify';
        // Integrate with existing Spotify player
      }
      
      // Emit track loaded event for UI updates
      // Components can use this to update their display state
      this.emit('trackLoaded', { track });
      
      // Auto-play if requested, otherwise just load for later playback
      // This provides immediate playback for user-initiated track changes
      if (autoPlay) {
        await this.play();
      }
      
    } catch (error) {
      console.error('Failed to load track:', error);
      // Emit error event for UI error handling
      // This allows components to show appropriate error messages
      this.emit('error', { error: 'Failed to load track', track });
      throw error;
    }
  }

  async play(): Promise<void> {
    if (!this.state.currentTrack) {
      throw new Error('No track loaded');
    }

    try {
      // Route playback command to appropriate audio engine
      // This ensures the correct audio source handles the play request
      if (this.state.source === 'local') {
        // Use local audio player for file-based playback
        // This handles local file system and audio decoding
        await localAudioPlayer.play();
      } else if (this.state.source === 'spotify') {
        // Use Spotify Web Playback SDK for streaming playback
        // This integrates with Spotify's streaming service
        // Integrate with existing Spotify player
        // await spotifyPlayer.resume();
      }
    } catch (error) {
      console.error('Failed to play:', error);
      // Emit error event for UI error handling
      // This allows components to show appropriate error messages
      this.emit('error', { error: 'Playback failed', track: this.state.currentTrack });
      throw error;
    }
  }

  async pause(): Promise<void> {
    // Route pause command to appropriate audio engine
    // This ensures the correct audio source handles the pause request
    if (this.state.source === 'local') {
      // Pause local audio player
      // This stops file-based playback immediately
      localAudioPlayer.pause();
    } else if (this.state.source === 'spotify') {
      // Pause Spotify Web Playback SDK
      // This pauses streaming playback
      // Integrate with existing Spotify player
      // await spotifyPlayer.pause();
    }
  }

  async stop(): Promise<void> {
    // Stop playback on all audio engines to ensure clean state
    // This prevents audio conflicts when switching between sources
    if (this.state.source === 'local') {
      // Stop local audio player and reset position
      // This ensures clean state for next track
      localAudioPlayer.stop();
    } else if (this.state.source === 'spotify') {
      // Stop Spotify Web Playback SDK
      // This stops streaming playback
      // Integrate with existing Spotify player
      // await spotifyPlayer.pause();
    }
    
    // Reset internal state to indicate no active playback
    // This maintains consistency between UI and playback state
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentPosition = 0;
  }

  async seek(position: number): Promise<void> {
    if (!this.state.currentTrack) {
      throw new Error('No track loaded');
    }

    // Validate seek position is within track bounds
    // This prevents seeking beyond the track duration
    if (position < 0 || position > this.state.duration) {
      throw new Error('Seek position out of bounds');
    }

    try {
      // Route seek command to appropriate audio engine
      // Different audio engines handle seeking differently
      if (this.state.source === 'local') {
        // Seek in local audio player
        // This handles file-based seeking with immediate response
        await localAudioPlayer.seek(position);
      } else if (this.state.source === 'spotify') {
        // Seek in Spotify Web Playback SDK
        // This handles streaming seeking (may have network delay)
        // Integrate with existing Spotify player
        // await spotifyPlayer.seek(position);
      }
      
      // Update internal position state
      // This maintains consistency between UI and playback state
      this.state.currentPosition = position;
    } catch (error) {
      console.error('Failed to seek:', error);
      // Emit error event for UI error handling
      this.emit('error', { error: 'Seek failed', track: this.state.currentTrack });
      throw error;
    }
  }

  async setVolume(volume: number): Promise<void> {
    // Validate volume is within acceptable range (0-1)
    // This prevents invalid volume levels that could cause audio issues
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }

    try {
      // Route volume command to appropriate audio engine
      // Both engines need volume synchronization for consistent experience
      if (this.state.source === 'local') {
        // Set volume in local audio player
        // This affects file-based playback volume
        await localAudioPlayer.setVolume(volume);
      } else if (this.state.source === 'spotify') {
        // Set volume in Spotify Web Playback SDK
        // This affects streaming playback volume
        // Integrate with existing Spotify player
        // await spotifyPlayer.setVolume(volume);
      }
      
      // Update internal volume state
      // This maintains consistency between UI and playback state
      this.state.volume = volume;
      
      // Save volume preference for persistence across sessions
      // This remembers user's volume preference
      this.saveVolume();
    } catch (error) {
      console.error('Failed to set volume:', error);
      // Emit error event for UI error handling
      this.emit('error', { error: 'Volume change failed' });
      throw error;
    }
  }

  async next(): Promise<void> {
    // Check if there are tracks in the queue to advance to
    // This prevents attempting to play non-existent tracks
    if (this.state.queue.length === 0 || this.state.currentIndex >= this.state.queue.length - 1) {
      console.log('No next track available');
      return;
    }

    try {
      // Calculate next track index
      // This handles queue navigation and looping
      const nextIndex = this.state.currentIndex + 1;
      const nextTrack = this.state.queue[nextIndex];
      
      // Update current track index
      // This maintains queue position state
      this.state.currentIndex = nextIndex;
      
      // Load and play the next track
      // This provides seamless track progression
      await this.loadTrack(nextTrack, true);
    } catch (error) {
      console.error('Failed to play next track:', error);
      // Emit error event for UI error handling
      this.emit('error', { error: 'Next track failed' });
      throw error;
    }
  }

  async previous(): Promise<void> {
    // Check if there are previous tracks in the queue
    // This prevents attempting to play non-existent tracks
    if (this.state.queue.length === 0 || this.state.currentIndex <= 0) {
      console.log('No previous track available');
      return;
    }

    try {
      // Calculate previous track index
      // This handles queue navigation and looping
      const prevIndex = this.state.currentIndex - 1;
      const prevTrack = this.state.queue[prevIndex];
      
      // Update current track index
      // This maintains queue position state
      this.state.currentIndex = prevIndex;
      
      // Load and play the previous track
      // This provides seamless track progression
      await this.loadTrack(prevTrack, true);
    } catch (error) {
      console.error('Failed to play previous track:', error);
      // Emit error event for UI error handling
      this.emit('error', { error: 'Previous track failed' });
      throw error;
    }
  }

  setQueue(tracks: EnhancedTrack[], startIndex = 0): void {
    console.log('🎵 setQueue called:', { 
      tracksCount: tracks.length, 
      startIndex, 
      firstTrack: tracks[0]?.name,
      selectedTrack: tracks[startIndex]?.name 
    });
    this.state.queue = [...tracks];
    this.state.currentIndex = startIndex;
    
    this.emit('queueChanged', { 
      queue: this.state.queue, 
      currentIndex: this.state.currentIndex 
    });
  }

  addToQueue(track: EnhancedTrack, position?: number): void {
    if (position === undefined) {
      this.state.queue.push(track);
    } else {
      this.state.queue.splice(position, 0, track);
      
      // Adjust current index if necessary
      if (position <= this.state.currentIndex) {
        this.state.currentIndex++;
      }
    }
    
    this.emit('queueChanged', { 
      queue: this.state.queue, 
      currentIndex: this.state.currentIndex 
    });
  }

  removeFromQueue(index: number): void {
    if (index >= 0 && index < this.state.queue.length) {
      this.state.queue.splice(index, 1);
      
      // Adjust current index if necessary
      if (index < this.state.currentIndex) {
        this.state.currentIndex--;
      } else if (index === this.state.currentIndex) {
        // Current track was removed, stop playback
        this.stop();
        this.state.currentIndex = Math.min(this.state.currentIndex, this.state.queue.length - 1);
      }
      
      this.emit('queueChanged', { 
        queue: this.state.queue, 
        currentIndex: this.state.currentIndex 
      });
    }
  }

  clearQueue(): void {
    this.state.queue = [];
    this.state.currentIndex = -1;
    this.stop();
    
    this.emit('queueChanged', { 
      queue: this.state.queue, 
      currentIndex: this.state.currentIndex 
    });
  }

  // State getters
  getCurrentTrack(): EnhancedTrack | null {
    return this.state.currentTrack;
  }

  getIsPlaying(): boolean {
    return this.state.isPlaying;
  }

  getIsPaused(): boolean {
    return this.state.isPaused;
  }

  getCurrentPosition(): number {
    if (this.state.source === 'local') {
      return localAudioPlayer.getCurrentPosition();
    } else if (this.state.source === 'spotify') {
      // Get position from Spotify player
      return this.state.currentPosition;
    }
    return 0;
  }

  getDuration(): number {
    if (this.state.source === 'local') {
      return localAudioPlayer.getDuration();
    } else if (this.state.source === 'spotify') {
      return this.state.duration;
    }
    return 0;
  }

  getVolume(): number {
    return this.state.volume;
  }

  getQueue(): EnhancedTrack[] {
    return [...this.state.queue];
  }

  getCurrentIndex(): number {
    return this.state.currentIndex;
  }

  getSource(): PlaybackSource | null {
    return this.state.source;
  }

  // Audio analysis (for visualizations)
  getAnalyserData(): Uint8Array | null {
    if (this.state.source === 'local') {
      return localAudioPlayer.getAnalyserData();
    }
    return null;
  }

  getWaveformData(): Uint8Array | null {
    if (this.state.source === 'local') {
      return localAudioPlayer.getWaveformData();
    }
    return null;
  }

  // Persistence
  private loadVolume(): void {
    const saved = localStorage.getItem('unifiedPlayerVolume');
    if (saved) {
      this.state.volume = parseFloat(saved);
    }
  }

  private saveVolume(): void {
    localStorage.setItem('unifiedPlayerVolume', this.state.volume.toString());
  }

  // Event system
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    localAudioPlayer.destroy();
    this.listeners.clear();
  }
}

// Singleton instance
export const unifiedPlayer = new UnifiedPlayerService();