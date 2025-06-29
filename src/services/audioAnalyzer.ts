export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private isInitialized = false;

  // Configuration
  private readonly FFT_SIZE = 2048; // Higher = more frequency resolution
  private readonly SMOOTHING = 0.8; // Smoothing factor for frequency data

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (required by many browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create analyzer node
      this.analyzerNode = this.audioContext.createAnalyser();
      this.analyzerNode.fftSize = this.FFT_SIZE;
      this.analyzerNode.smoothingTimeConstant = this.SMOOTHING;

      // Initialize frequency data array
      const bufferLength = this.analyzerNode.frequencyBinCount;
      this.frequencyData = new Uint8Array(bufferLength);

      this.isInitialized = true;
      console.log('AudioAnalyzer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioAnalyzer:', error);
      throw error;
    }
  }

  connectToAudioElement(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyzerNode) {
      throw new Error('AudioAnalyzer not initialized');
    }

    try {
      console.log('🔌 Connecting to audio element...');
      
      // Disconnect previous source if exists
      if (this.sourceNode) {
        console.log('🔄 Disconnecting previous audio source');
        this.sourceNode.disconnect();
      }

      // Create source from audio element
      console.log('📡 Creating MediaElementAudioSource...');
      this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
      
      // Connect: source -> analyzer -> destination
      console.log('🔗 Connecting audio graph: source -> analyzer -> destination');
      this.sourceNode.connect(this.analyzerNode);
      this.analyzerNode.connect(this.audioContext.destination);

      console.log('✅ Audio element connected to analyzer successfully');
      console.log('AudioContext state:', this.audioContext.state);
      console.log('AudioContext sample rate:', this.audioContext.sampleRate);
    } catch (error) {
      console.error('❌ Failed to connect audio element:', error);
      
      // Additional debugging for CORS issues
      if (error instanceof DOMException) {
        console.error('DOMException details:', {
          name: error.name,
          message: error.message,
          code: error.code
        });
        
        if (error.name === 'SecurityError') {
          console.error('🚨 CORS Security Error: This is likely because Spotify uses cross-origin audio that cannot be analyzed due to security restrictions.');
          console.error('💡 Possible solutions:');
          console.error('  1. Use Spotify Web Playback SDK with proper CORS headers');
          console.error('  2. Use getUserMedia() to capture system audio');
          console.error('  3. Use a different audio source for visualization');
        }
      }
      
      throw error;
    }
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyzerNode || !this.frequencyData) {
      return null;
    }

    // Get current frequency data
    this.analyzerNode.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getFrequencyBands(numBands: number = 32): number[] {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) {
      return new Array(numBands).fill(0);
    }

    const bands: number[] = [];
    const binSize = Math.floor(frequencyData.length / numBands);

    for (let i = 0; i < numBands; i++) {
      let sum = 0;
      const start = i * binSize;
      const end = Math.min(start + binSize, frequencyData.length);

      // Average the frequency bins for this band
      for (let j = start; j < end; j++) {
        sum += frequencyData[j];
      }

      // Normalize to 0-1 range
      const average = sum / (end - start);
      bands.push(average / 255);
    }

    return bands;
  }

  // Get frequency data mapped to a 2D grid
  getGridFrequencyData(gridWidth: number, gridHeight: number): number[][] {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) {
      // Return empty grid
      return Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(0));
    }

    const grid: number[][] = [];
    const totalCells = gridWidth * gridHeight;
    const binSize = Math.floor(frequencyData.length / totalCells);

    for (let row = 0; row < gridHeight; row++) {
      const gridRow: number[] = [];
      
      for (let col = 0; col < gridWidth; col++) {
        const cellIndex = row * gridWidth + col;
        const start = cellIndex * binSize;
        const end = Math.min(start + binSize, frequencyData.length);

        // Average frequency data for this cell
        let sum = 0;
        for (let i = start; i < end; i++) {
          sum += frequencyData[i];
        }

        const average = end > start ? sum / (end - start) : 0;
        gridRow.push(average / 255); // Normalize to 0-1
      }
      
      grid.push(gridRow);
    }

    return grid;
  }

  getAverageFrequency(): number {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return 0;

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }

    return (sum / frequencyData.length) / 255; // Normalize to 0-1
  }

  getBassLevel(): number {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return 0;

    // Bass frequencies are typically in the lower 10% of the spectrum
    const bassRange = Math.floor(frequencyData.length * 0.1);
    let sum = 0;

    for (let i = 0; i < bassRange; i++) {
      sum += frequencyData[i];
    }

    return (sum / bassRange) / 255; // Normalize to 0-1
  }

  getTrebleLevel(): number {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return 0;

    // Treble frequencies are typically in the upper 30% of the spectrum
    const trebleStart = Math.floor(frequencyData.length * 0.7);
    let sum = 0;
    let count = 0;

    for (let i = trebleStart; i < frequencyData.length; i++) {
      sum += frequencyData[i];
      count++;
    }

    return count > 0 ? (sum / count) / 255 : 0; // Normalize to 0-1
  }

  // Fallback: Connect to microphone if Spotify audio fails
  async connectToMicrophone(): Promise<void> {
    if (!this.audioContext || !this.analyzerNode) {
      throw new Error('AudioAnalyzer not initialized');
    }

    try {
      console.log('🎤 Attempting to connect to microphone...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      // Disconnect previous source if exists
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }

      // Create source from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Connect: source -> analyzer (no destination for mic)
      this.sourceNode.connect(this.analyzerNode);

      console.log('✅ Microphone connected to analyzer successfully');
    } catch (error) {
      console.error('❌ Failed to connect microphone:', error);
      throw error;
    }
  }

  dispose(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.frequencyData = null;
    this.isInitialized = false;
    console.log('AudioAnalyzer disposed');
  }
}

// Singleton instance
export const audioAnalyzer = new AudioAnalyzer();