import { LocalTrack, AudioPlayerConfig } from '../types/spotify';

export class LocalAudioPlayerService {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  
  private currentTrack: LocalTrack | null = null;
  private isPlaying = false;
  private isPaused = false;
  private startTime = 0;
  private pauseTime = 0;
  private duration = 0;
  private volume = 0.5;
  
  private config: AudioPlayerConfig = {
    enableLocalPlayback: true,
    maxCacheSize: 100, // 100MB
    audioQuality: 'auto',
    crossfadeDuration: 0,
    gaplessPlayback: true
  };

  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeAudioContext();
    this.setupEventListeners();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Setup audio nodes
      this.gainNode = this.audioContext.createGain();
      this.analyserNode = this.audioContext.createAnalyser();
      
      // Connect nodes
      this.gainNode.connect(this.audioContext.destination);
      this.analyserNode.connect(this.gainNode);
      
      this.gainNode.gain.value = this.volume;
      this.analyserNode.fftSize = 2048;
      
      console.log('🎵 Local audio player initialized');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw new Error('Audio context initialization failed');
    }
  }

  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying) {
        // Browser may suspend audio context when tab is hidden
        this.handleContextSuspension();
      } else if (!document.hidden && this.audioContext?.state === 'suspended') {
        this.resumeAudioContext();
      }
    });
  }

  private async handleContextSuspension(): Promise<void> {
    if (this.audioContext?.state === 'running') {
      try {
        await this.audioContext.suspend();
      } catch (error) {
        console.warn('Failed to suspend audio context:', error);
      }
    }
  }

  private async resumeAudioContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  async loadTrack(track: LocalTrack): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Stop current playback
      this.stop();
      
      this.currentTrack = track;
      
      // Load audio file
      const audioData = await this.loadAudioFile(track.filePath);
      
      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.duration = this.audioBuffer.duration * 1000; // Convert to milliseconds
      
      this.emit('trackLoaded', { track, duration: this.duration });
      
      console.log(`🎵 Loaded local track: ${track.name} (${track.format})`);
    } catch (error) {
      console.error('Failed to load track:', error);
      this.emit('error', { error: 'Failed to load audio file', track });
      throw error;
    }
  }

  private async loadAudioFile(filePath: string): Promise<ArrayBuffer> {
    try {
      // In Electron environment, we can use Node.js file system
      if (window.electronAPI) {
        return await window.electronAPI.readAudioFile(filePath);
      }
      
      // Fallback for web environment (file input)
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      console.error('Failed to load audio file:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (!this.audioContext || !this.audioBuffer) {
      throw new Error('No track loaded');
    }

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Stop any existing source
      if (this.audioSource) {
        this.audioSource.stop();
        this.audioSource.disconnect();
      }

      // Create new audio source
      this.audioSource = this.audioContext.createBufferSource();
      this.audioSource.buffer = this.audioBuffer;
      
      // Connect to analyser for visualizations
      this.audioSource.connect(this.analyserNode!);
      
      // Handle playback end
      this.audioSource.onended = () => {
        if (this.isPlaying) {
          this.emit('trackEnded', { track: this.currentTrack });
        }
      };

      // Start playback
      const offset = this.isPaused ? this.pauseTime / 1000 : 0;
      this.audioSource.start(0, offset);
      
      this.startTime = this.audioContext.currentTime - offset;
      this.isPlaying = true;
      this.isPaused = false;
      
      this.emit('playbackStarted', { track: this.currentTrack });
      
      console.log(`▶️ Playing: ${this.currentTrack?.name}`);
    } catch (error) {
      console.error('Failed to play track:', error);
      this.emit('error', { error: 'Playback failed', track: this.currentTrack });
      throw error;
    }
  }

  pause(): void {
    if (this.isPlaying && this.audioSource) {
      this.audioSource.stop();
      this.pauseTime = this.getCurrentPosition();
      this.isPlaying = false;
      this.isPaused = true;
      
      this.emit('playbackPaused', { track: this.currentTrack, position: this.pauseTime });
      
      console.log(`⏸️ Paused: ${this.currentTrack?.name}`);
    }
  }

  stop(): void {
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    
    this.isPlaying = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pauseTime = 0;
    
    this.emit('playbackStopped', { track: this.currentTrack });
  }

  async seek(position: number): Promise<void> {
    if (!this.audioBuffer || !this.audioContext) {
      return;
    }

    const wasPlaying = this.isPlaying;
    this.stop();
    
    this.pauseTime = position;
    
    if (wasPlaying) {
      await this.play();
    } else {
      this.isPaused = true;
    }
    
    this.emit('seeked', { track: this.currentTrack, position });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
    
    this.emit('volumeChanged', { volume: this.volume });
  }

  getVolume(): number {
    return this.volume;
  }

  getCurrentPosition(): number {
    if (!this.audioContext) return 0;
    
    if (this.isPlaying) {
      return (this.audioContext.currentTime - this.startTime) * 1000;
    } else if (this.isPaused) {
      return this.pauseTime;
    }
    
    return 0;
  }

  getDuration(): number {
    return this.duration;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getCurrentTrack(): LocalTrack | null {
    return this.currentTrack;
  }

  // Audio analysis for visualizations
  getAnalyserData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getWaveformData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
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

  // Configuration
  updateConfig(config: Partial<AudioPlayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AudioPlayerConfig {
    return { ...this.config };
  }

  // Cleanup
  destroy(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.listeners.clear();
  }
}

// Singleton instance
export const localAudioPlayer = new LocalAudioPlayerService();