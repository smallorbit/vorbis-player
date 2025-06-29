import { useEffect, useRef, useState } from 'react';
import { audioAnalyzer } from '../services/audioAnalyzer';

export interface AudioAnalysisData {
  frequencyBands: number[];
  gridData: number[][];
  averageFrequency: number;
  bassLevel: number;
  trebleLevel: number;
  isAnalyzing: boolean;
}

export const useAudioAnalysis = (gridWidth: number = 50, gridHeight: number = 50) => {
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData>({
    frequencyBands: [],
    gridData: [],
    averageFrequency: 0,
    bassLevel: 0,
    trebleLevel: 0,
    isAnalyzing: false,
  });

  const animationFrameRef = useRef<number>();
  const isInitializedRef = useRef(false);

  // Initialize audio analyzer
  useEffect(() => {
    const initializeAnalyzer = async () => {
      try {
        await audioAnalyzer.initialize();
        isInitializedRef.current = true;
        
        // Try to connect to any existing audio elements
        const audioElements = document.querySelectorAll('audio');
        console.log(`Found ${audioElements.length} audio elements`);
        
        if (audioElements.length > 0) {
          const audioEl = audioElements[0] as HTMLAudioElement;
          console.log('Audio element details:', {
            src: audioEl.src,
            srcObject: audioEl.srcObject,
            readyState: audioEl.readyState,
            paused: audioEl.paused,
            currentTime: audioEl.currentTime,
            duration: audioEl.duration
          });
          audioAnalyzer.connectToAudioElement(audioEl);
        } else {
          console.log('No audio elements found during initialization');
        }
      } catch (error) {
        console.error('Failed to initialize audio analyzer:', error);
      }
    };

    initializeAnalyzer();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioAnalyzer.dispose();
    };
  }, []);

  // Start/stop analysis loop
  const startAnalysis = () => {
    if (!isInitializedRef.current) return;

    const updateAnalysis = () => {
      const frequencyBands = audioAnalyzer.getFrequencyBands(32);
      const gridData = audioAnalyzer.getGridFrequencyData(gridWidth, gridHeight);
      const averageFrequency = audioAnalyzer.getAverageFrequency();
      const bassLevel = audioAnalyzer.getBassLevel();
      const trebleLevel = audioAnalyzer.getTrebleLevel();

      setAnalysisData({
        frequencyBands,
        gridData,
        averageFrequency,
        bassLevel,
        trebleLevel,
        isAnalyzing: true,
      });

      animationFrameRef.current = requestAnimationFrame(updateAnalysis);
    };

    updateAnalysis();
  };

  const stopAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    
    setAnalysisData(prev => ({ ...prev, isAnalyzing: false }));
  };

  // Connect to a specific audio element
  const connectToAudioElement = (audioElement: HTMLAudioElement) => {
    try {
      console.log('Attempting to connect to audio element:', {
        tagName: audioElement.tagName,
        src: audioElement.src,
        srcObject: audioElement.srcObject,
        readyState: audioElement.readyState,
        paused: audioElement.paused,
        currentTime: audioElement.currentTime,
        crossOrigin: audioElement.crossOrigin
      });
      
      audioAnalyzer.connectToAudioElement(audioElement);
      console.log('✅ Successfully connected to audio element for analysis');
    } catch (error) {
      console.error('❌ Failed to connect to audio element:', error);
    }
  };

  return {
    analysisData,
    startAnalysis,
    stopAnalysis,
    connectToAudioElement,
  };
};