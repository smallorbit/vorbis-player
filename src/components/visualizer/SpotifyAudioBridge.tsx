import { useEffect, useRef, useCallback } from 'react';
import { useVisualizerStore } from '../../lib/visualizer/state';
import { spotifyPlayer } from '../../services/spotifyPlayer';
import FFTAnalyzer from '../../lib/visualizer/analyzers/fft';

interface SpotifyAudioBridgeProps {
  onAnalyzerReady?: (analyzer: FFTAnalyzer) => void;
}

/**
 * SpotifyAudioBridge connects the Spotify Web Playback SDK to the FFT analyzer.
 * Since Spotify SDK doesn't expose direct audio element access, this component
 * creates an audio context that can capture browser audio output for visualization.
 */
export default function SpotifyAudioBridge({ onAnalyzerReady }: SpotifyAudioBridgeProps) {
  const {
    isVisualizerActive,
    setAudioContext,
    setAnalyzerNode,
    setFFTAnalyzer,
    setFrequencyData,
    setAudioCaptureActive,
    audioContext,
    fftAnalyzer
  } = useVisualizerStore();

  const analyzerRef = useRef<FFTAnalyzer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isInitializedRef = useRef(false);

  const cleanup = useCallback(() => {
    // Stop analyzer
    if (analyzerRef.current) {
      analyzerRef.current.toggleAnalyzer(false);
      analyzerRef.current.disconnectInputs();
      analyzerRef.current = null;
    }

    // Disconnect source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }

    // Reset store state
    setAudioContext(null);
    setAnalyzerNode(null);
    setFFTAnalyzer(null);
    setFrequencyData([]);
    setAudioCaptureActive(false);
    isInitializedRef.current = false;
  }, [audioContext, setAudioContext, setAnalyzerNode, setFFTAnalyzer, setFrequencyData, setAudioCaptureActive]);

  const initializeAudioCapture = useCallback(async () => {
    if (isInitializedRef.current || !isVisualizerActive) {
      return;
    }

    try {
      // Request access to system audio (this will prompt user for permission)
      // Note: This captures all system audio, not just Spotify
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;

      // Create audio context
      const ctx = new AudioContext({ sampleRate: 44100 });
      setAudioContext(ctx);

      // Resume context if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Create source from the captured stream
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create analyzer
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 8192;
      analyzer.smoothingTimeConstant = 0.5;
      analyzer.minDecibels = -85;
      analyzer.maxDecibels = -25;

      setAnalyzerNode(analyzer);

      // Connect source to analyzer
      source.connect(analyzer);

      // Create a dummy audio element for our FFT analyzer
      // Since we can't get the actual Spotify audio element, we'll work around this
      const dummyAudio = document.createElement('audio');
      dummyAudio.crossOrigin = 'anonymous';
      
      // Create FFT analyzer instance with our audio context
      const fftAnalyzer = new FFTAnalyzer(dummyAudio, ctx);
      
      // Manually connect our stream source to the FFT analyzer's input
      fftAnalyzer.disconnectInputs(); // Disconnect the dummy audio element
      fftAnalyzer.connectInput(source);

      analyzerRef.current = fftAnalyzer;
      setFFTAnalyzer(fftAnalyzer);
      setAudioCaptureActive(true);
      
      if (onAnalyzerReady) {
        onAnalyzerReady(fftAnalyzer);
      }

      isInitializedRef.current = true;

      console.log('Audio bridge initialized successfully');

    } catch (error) {
      console.error('Failed to initialize audio capture:', error);
      
      // Fallback: Try to use getUserMedia for microphone input
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });

        streamRef.current = micStream;

        const ctx = new AudioContext({ sampleRate: 44100 });
        setAudioContext(ctx);

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const source = ctx.createMediaStreamSource(micStream);
        sourceRef.current = source;

        const analyzer = ctx.createAnalyser();
        analyzer.fftSize = 8192;
        analyzer.smoothingTimeConstant = 0.5;
        analyzer.minDecibels = -85;
        analyzer.maxDecibels = -25;

        setAnalyzerNode(analyzer);
        source.connect(analyzer);

        const dummyAudio = document.createElement('audio');
        dummyAudio.crossOrigin = 'anonymous';
        
        const fftAnalyzer = new FFTAnalyzer(dummyAudio, ctx);
        fftAnalyzer.disconnectInputs();
        fftAnalyzer.connectInput(source);

        analyzerRef.current = fftAnalyzer;
        setFFTAnalyzer(fftAnalyzer);
        setAudioCaptureActive(true);
        
        if (onAnalyzerReady) {
          onAnalyzerReady(fftAnalyzer);
        }

        isInitializedRef.current = true;

        console.log('Audio bridge initialized with microphone fallback');

      } catch (fallbackError) {
        console.error('Failed to initialize audio capture with microphone fallback:', fallbackError);
      }
    }
  }, [isVisualizerActive, onAnalyzerReady, setAudioContext, setAnalyzerNode, setFFTAnalyzer, setAudioCaptureActive]);

  // Initialize audio capture when visualizer becomes active
  useEffect(() => {
    if (isVisualizerActive && !isInitializedRef.current) {
      initializeAudioCapture();
    } else if (!isVisualizerActive && isInitializedRef.current) {
      cleanup();
    }
  }, [isVisualizerActive, initializeAudioCapture, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Update frequency data in store
  useEffect(() => {
    if (!fftAnalyzer || !isVisualizerActive) {
      return;
    }

    let animationFrameId: number;

    const updateFrequencyData = () => {
      const bars = fftAnalyzer.getBars();
      if (bars && bars.length > 0) {
        setFrequencyData([...bars]); // Create a new array to trigger reactivity
      }
      animationFrameId = requestAnimationFrame(updateFrequencyData);
    };

    animationFrameId = requestAnimationFrame(updateFrequencyData);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [fftAnalyzer, isVisualizerActive, setFrequencyData]);

  // Handle Spotify player state changes
  useEffect(() => {
    if (!spotifyPlayer.getIsReady() || !isVisualizerActive) {
      return;
    }

    const handlePlayerStateChange = async (state: SpotifyPlaybackState | null) => {
      if (analyzerRef.current) {
        if (state && !state.paused) {
          // Resume analysis when playing
          analyzerRef.current.toggleAnalyzer(true);
        } else {
          // Pause analysis when paused
          analyzerRef.current.toggleAnalyzer(false);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);

    // Initial state check
    spotifyPlayer.getCurrentState().then(handlePlayerStateChange);
  }, [isVisualizerActive]);

  // This component doesn't render anything visible
  return null;
}

export { SpotifyAudioBridge };