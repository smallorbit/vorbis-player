import type { LocalTrack, AudioPlayerConfig } from '../types/spotify.d.ts';

export class LocalAudioPlayerService {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private useHTMLAudio = false;
  
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
    try {
      // Stop current playback
      this.stop();
      
      this.currentTrack = track;
      
      console.log(`🎵 Loading track: ${track.name} from ${track.filePath} (${track.format}, codec: ${track.codec || 'unknown'})`);
      
      // For M4A files (both AAC and ALAC) and AAC files, try HTML5 Audio first (better codec support)
      // ALAC in particular needs HTML5 Audio as Web Audio API has limited support
      if (track.format === 'm4a' || track.format === 'aac' || track.codec === 'ALAC') {
        await this.loadTrackWithHTMLAudio(track);
      } else {
        // Use Web Audio API for other formats
        await this.loadTrackWithWebAudio(track);
      }
      
      this.emit('trackLoaded', { track, duration: this.duration });
      
      console.log(`🎵 Successfully loaded local track: ${track.name} (${track.format}, codec: ${track.codec || 'unknown'}), duration: ${this.duration}ms`);
    } catch (error) {
      console.error('Failed to load track:', error);
      console.error('Track details:', { 
        name: track.name, 
        filePath: track.filePath, 
        format: track.format,
        codec: track.codec,
        fileSize: track.fileSize
      });
      
      // If Web Audio API fails for M4A, try HTML5 Audio as fallback
      // If HTML5 fails for M4A, try Web Audio API as fallback
      const isM4ARelated = (track.format === 'm4a' || track.format === 'aac' || track.codec === 'ALAC');
      
      if (isM4ARelated && (error.name === 'EncodingError' || error.message.includes('HTML5 Audio'))) {
        const fallbackMethod = error.message.includes('HTML5 Audio') ? 'Web Audio API' : 'HTML5 Audio';
        console.log(`🔄 Falling back to ${fallbackMethod} for ${track.format} file (codec: ${track.codec || 'unknown'})`);
        try {
          if (fallbackMethod === 'Web Audio API') {
            await this.loadTrackWithWebAudio(track);
          } else {
            await this.loadTrackWithHTMLAudio(track);
          }
          this.emit('trackLoaded', { track, duration: this.duration });
          console.log(`🎵 Successfully loaded with ${fallbackMethod}: ${track.name}`);
          return;
        } catch (fallbackError) {
          console.error(`${fallbackMethod} fallback also failed:`, fallbackError);
        }
      }
      
      this.emit('error', { error: 'Failed to load audio file', track });
      throw error;
    }
  }

  private async loadTrackWithWebAudio(track: LocalTrack): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Load audio file
    const audioData = await this.loadAudioFile(track.filePath);
    console.log(`📁 Loaded audio data: ${audioData.byteLength} bytes`);
    
    // Decode audio data
    this.audioBuffer = await this.audioContext.decodeAudioData(audioData);
    this.duration = this.audioBuffer.duration * 1000; // Convert to milliseconds
    this.useHTMLAudio = false;
  }

  private async loadTrackWithHTMLAudio(track: LocalTrack): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.htmlAudio) {
        this.htmlAudio = new Audio();
      }

      const audio = this.htmlAudio;
      
      // Create a blob URL from the file path for HTML5 Audio
      this.createAudioBlobURL(track.filePath).then(blobURL => {
        audio.src = blobURL;
        
        const onLoadedMetadata = () => {
          this.duration = audio.duration * 1000; // Convert to milliseconds
          this.useHTMLAudio = true;
          console.log(`🎵 HTML5 Audio loaded: duration ${this.duration}ms`);
          
          // Cleanup event listeners
          audio.removeEventListener('loadedmetadata', onLoadedMetadata);
          audio.removeEventListener('error', onError);
          
          resolve();
        };

        const onError = (e: Event) => {
          console.error('HTML5 Audio loading error:', e);
          console.error('Audio element error details:', {
            error: (e.target as HTMLAudioElement).error,
            networkState: (e.target as HTMLAudioElement).networkState,
            readyState: (e.target as HTMLAudioElement).readyState,
            src: (e.target as HTMLAudioElement).src
          });
          
          // Cleanup event listeners
          audio.removeEventListener('loadedmetadata', onLoadedMetadata);
          audio.removeEventListener('error', onError);
          
          reject(new Error('Failed to load audio with HTML5 Audio'));
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('error', onError);
        
        // Start loading
        audio.load();
      }).catch(reject);
    });
  }

  private async createAudioBlobURL(filePath: string): Promise<string> {
    try {
      if (window.electronAPI) {
        console.log(`📁 Creating blob URL for: ${filePath}`);
        const buffer = await window.electronAPI.readFileBuffer(filePath);
        console.log(`📁 Read buffer: ${buffer.length} bytes`);
        
        // Use appropriate MIME type based on format
        // Note: ALAC files use the same container as AAC (audio/mp4)
        // The browser will handle the codec detection internally
        let mimeType = 'audio/mp4'; // Default for m4a/aac/alac
        
        const format = filePath.split('.').pop()?.toLowerCase();
        if (format === 'mp3') {
          mimeType = 'audio/mpeg';
        } else if (format === 'ogg') {
          mimeType = 'audio/ogg';
        } else if (format === 'wav') {
          mimeType = 'audio/wav';
        } else if (format === 'flac') {
          mimeType = 'audio/flac';
        }
        
        console.log(`🎵 Using MIME type: ${mimeType} for format: ${format}`);
        
        const blob = new Blob([buffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        console.log(`🔗 Created blob URL: ${blobUrl}`);
        return blobUrl;
      } else {
        // Fallback for web environment
        console.log(`🔗 Using file path directly: ${filePath}`);
        return filePath;
      }
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      console.error('File path:', filePath);
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
    if (!this.currentTrack) {
      throw new Error('No track loaded');
    }

    try {
      if (this.useHTMLAudio) {
        await this.playWithHTMLAudio();
      } else {
        await this.playWithWebAudio();
      }
      
      this.isPlaying = true;
      this.isPaused = false;
      
      this.emit('playbackStarted', { track: this.currentTrack });
      
      console.log(`▶️ Playing: ${this.currentTrack?.name} (${this.useHTMLAudio ? 'HTML5' : 'WebAudio'})`);
    } catch (error) {
      console.error('Failed to play track:', error);
      this.emit('error', { error: 'Playback failed', track: this.currentTrack });
      throw error;
    }
  }

  private async playWithWebAudio(): Promise<void> {
    if (!this.audioContext || !this.audioBuffer) {
      throw new Error('Web Audio API not ready');
    }

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
  }

  private async playWithHTMLAudio(): Promise<void> {
    if (!this.htmlAudio) {
      throw new Error('HTML5 Audio not ready');
    }

    const audio = this.htmlAudio;
    
    // Set up event listeners for HTML5 Audio
    audio.onended = () => {
      if (this.isPlaying) {
        this.emit('trackEnded', { track: this.currentTrack });
      }
    };

    // Resume from paused position
    if (this.isPaused && this.pauseTime > 0) {
      audio.currentTime = this.pauseTime / 1000;
    }

    // Start playback
    await audio.play();
    this.startTime = Date.now() / 1000 - audio.currentTime;
  }

  pause(): void {
    if (!this.isPlaying) return;

    if (this.useHTMLAudio && this.htmlAudio) {
      this.htmlAudio.pause();
      this.pauseTime = this.htmlAudio.currentTime * 1000; // Convert to milliseconds
    } else if (this.audioSource) {
      this.audioSource.stop();
      this.pauseTime = this.getCurrentPosition();
    }
    
    this.isPlaying = false;
    this.isPaused = true;
    
    this.emit('playbackPaused', { track: this.currentTrack, position: this.pauseTime });
    
    console.log(`⏸️ Paused: ${this.currentTrack?.name}`);
  }

  stop(): void {
    if (this.useHTMLAudio && this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.currentTime = 0;
    } else if (this.audioSource) {
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
    if (this.useHTMLAudio && this.htmlAudio) {
      this.htmlAudio.currentTime = position / 1000; // Convert from milliseconds
      if (this.isPlaying) {
        this.startTime = Date.now() / 1000 - this.htmlAudio.currentTime;
      }
    } else if (this.audioBuffer && this.audioContext) {
      const wasPlaying = this.isPlaying;
      this.stop();
      
      this.pauseTime = position;
      
      if (wasPlaying) {
        await this.play();
      } else {
        this.isPaused = true;
      }
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
    if (this.useHTMLAudio && this.htmlAudio) {
      return this.htmlAudio.currentTime * 1000; // Convert to milliseconds
    } else if (this.audioContext) {
      if (this.isPlaying) {
        return (this.audioContext.currentTime - this.startTime) * 1000;
      } else if (this.isPaused) {
        return this.pauseTime;
      }
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

    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.src = '';
      this.htmlAudio = null;
    }
    
    this.listeners.clear();
  }
}

// Singleton instance
export const localAudioPlayer = new LocalAudioPlayerService();