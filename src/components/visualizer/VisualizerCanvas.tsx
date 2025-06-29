import React, { Suspense, useRef, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Matrix4, Vector3, Quaternion } from 'three';
import { useAudioAnalysis } from '../../hooks/useAudioAnalysis';
import type { Mesh } from 'three';

interface VisualizerCanvasProps {
  className?: string;
}

// Fallback loading component
const LoadingFallback = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="#333" wireframe />
  </mesh>
);

// Basic ground/floor component for visual reference
const Ground = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
    <planeGeometry args={[50, 50]} />
    <meshStandardMaterial color="#111" transparent opacity={0.3} />
  </mesh>
);

// Audio-reactive grid visualizer with real audio analysis
const GridVisualizer = () => {
  const meshRef = useRef<any>(null);
  const tmpMatrix = useMemo(() => new Matrix4(), []);

  // Grid configuration matching the reference
  const nGridRows = 50;
  const nGridCols = 50;
  const cubeSideLength = 0.025;
  const cubeSpacingScalar = 3;
  const totalCubes = nGridRows * nGridCols;

  // Audio analysis hook
  const { analysisData, startAnalysis, stopAnalysis, connectToAudioElement } = useAudioAnalysis(nGridCols, nGridRows);

  // Start analysis when component mounts
  useEffect(() => {
    startAnalysis();
    return () => stopAnalysis();
  }, []);

  // Try to connect to Spotify audio when available
  useEffect(() => {
    const findAndConnectAudio = () => {
      console.log('🔍 Searching for audio elements...');
      
      // Look for all audio elements
      const audioElements = document.querySelectorAll('audio');
      console.log(`Found ${audioElements.length} audio elements`);
      
      // Log details about each audio element
      audioElements.forEach((audio, index) => {
        const audioEl = audio as HTMLAudioElement;
        console.log(`Audio element ${index}:`, {
          src: audioEl.src,
          srcObject: audioEl.srcObject,
          readyState: audioEl.readyState,
          paused: audioEl.paused,
          currentTime: audioEl.currentTime,
          duration: audioEl.duration,
          volume: audioEl.volume,
          muted: audioEl.muted,
          crossOrigin: audioEl.crossOrigin,
          className: audioEl.className,
          id: audioEl.id
        });
      });
      
      // Try to connect to any audio element that seems to be playing
      for (const audio of audioElements) {
        const audioEl = audio as HTMLAudioElement;
        if (audioEl.src || audioEl.srcObject || audioEl.currentTime > 0) {
          console.log('🎯 Attempting to connect to audio element...');
          connectToAudioElement(audioEl);
          break;
        }
      }
      
      // Also look for Spotify-specific elements and Web Audio nodes
      const spotifyElements = document.querySelectorAll('[data-testid*="audio"], [class*="spotify"], [id*="spotify"]');
      console.log(`Found ${spotifyElements.length} potential Spotify elements`);
      
      // Check if Spotify Web Playback SDK is available
      if (window.Spotify) {
        console.log('🎵 Spotify Web Playback SDK detected');
        // Note: Unfortunately, Spotify Web Playback SDK doesn't expose raw audio data
        // for security reasons, so we can't directly analyze it
      }
      
      // Check for any Web Audio API contexts that might be active
      const webAudioNodes = [];
      if (window.webkitAudioContext || window.AudioContext) {
        console.log('🔊 Web Audio API available');
      }
    };

    // Try immediately
    findAndConnectAudio();

    // Try multiple times as Spotify loads asynchronously
    const timeouts = [
      setTimeout(findAndConnectAudio, 1000),
      setTimeout(findAndConnectAudio, 3000),
      setTimeout(findAndConnectAudio, 5000),
    ];
    
    // Also try when the user starts playing music
    const handlePlay = () => {
      console.log('🎵 Play event detected, searching for audio...');
      setTimeout(findAndConnectAudio, 500);
    };
    
    document.addEventListener('play', handlePlay, true);
    
    return () => {
      timeouts.forEach(clearTimeout);
      document.removeEventListener('play', handlePlay, true);
    };
  }, [connectToAudioElement]);

  // Coordinate mapper function using real audio data
  const coordinateMapper = (normGridX: number, normGridY: number, time: number) => {
    const { gridData, bassLevel, trebleLevel, averageFrequency } = analysisData;

    // Use real audio data if available
    if (gridData.length > 0) {
      const row = Math.floor(normGridY * (gridData.length - 1));
      const col = Math.floor(normGridX * (gridData[0].length - 1));
      const audioValue = gridData[row]?.[col] || 0;
      
      // Amplify the audio signal and add some base movement
      return audioValue * 2.0 + averageFrequency * 0.5;
    }

    // Fallback to pseudo-audio if no real data
    const wave1 = Math.sin(time * 2 + normGridX * 10) * 0.3;
    const wave2 = Math.sin(time * 1.5 + normGridY * 8) * 0.2;
    const wave3 = Math.sin(time * 3 + (normGridX + normGridY) * 6) * 0.4;
    const centerDistance = Math.hypot(normGridX - 0.5, normGridY - 0.5);
    const radialWave = Math.sin(time * 1.8 + centerDistance * 12) * 0.5;

    return (wave1 + wave2 + wave3 + radialWave) * 0.8;
  };

  // Color setup based on radial distance and audio reactivity
  const getColor = (normRadialOffset: number) => {
    const { bassLevel, trebleLevel, averageFrequency } = analysisData;
    
    // Base color gradient from center to edge
    let lightness = 0.6 + normRadialOffset * 0.2;
    
    // Modulate colors based on audio
    const bassIntensity = bassLevel * 0.4;
    const trebleIntensity = trebleLevel * 0.3;
    
    return {
      r: lightness + bassIntensity, // Red responds to bass
      g: lightness * 0.8 + averageFrequency * 0.3, // Green responds to overall level
      b: lightness * 1.2 + trebleIntensity // Blue responds to treble
    };
  };

  // Update colors based on audio data
  useEffect(() => {
    if (!meshRef.current) return;

    const normQuadrantHypotenuse = Math.hypot(0.5, 0.5);

    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        const instanceIdx = row * nGridCols + col;
        const normGridX = row / (nGridRows - 1);
        const normGridY = col / (nGridCols - 1);
        const normRadialOffset = Math.hypot(normGridX - 0.5, normGridY - 0.5) / normQuadrantHypotenuse;

        const color = getColor(normRadialOffset);
        meshRef.current.setColorAt(instanceIdx, new Vector3(color.r, color.g, color.b));
      }
    }

    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nGridRows, nGridCols, analysisData.bassLevel, analysisData.trebleLevel, analysisData.averageFrequency]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const elapsedTimeSec = clock.getElapsedTime();
    const gridSizeX = nGridRows * cubeSpacingScalar * cubeSideLength;
    const gridSizeY = nGridCols * cubeSpacingScalar * cubeSideLength;

    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        const instanceIdx = row * nGridCols + col;
        const normGridX = row / (nGridRows - 1);
        const normGridY = col / (nGridCols - 1);

        // Get Z coordinate from our coordinate mapper
        const z = coordinateMapper(normGridX, normGridY, elapsedTimeSec);

        // Calculate X and Y positions (centered grid)
        const x = gridSizeX * (normGridX - 0.5);
        const y = gridSizeY * (normGridY - 0.5);

        // Set position using the tmpMatrix
        tmpMatrix.setPosition(x, y, z);
        meshRef.current.setMatrixAt(instanceIdx, tmpMatrix);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalCubes]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[cubeSideLength, cubeSideLength, cubeSideLength]} />
      <meshPhongMaterial
        color="white"
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
};

const CanvasContainer = styled.div`
  width: 100%;
  height: 100%;
`;

const AudioIndicator = styled.div<{ isActive: boolean }>`
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 8px 12px;
  background: ${props => props.isActive ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'};
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  z-index: 10;
`;

const MicButton = styled.button`
  position: absolute;
  top: 50px;
  right: 10px;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.8);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  z-index: 10;
  
  &:hover {
    background: rgba(59, 130, 246, 1);
  }
`;

const DebugInfo = styled.div`
  position: absolute;
  top: 90px;
  right: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 6px;
  font-size: 10px;
  font-family: monospace;
  z-index: 10;
  max-width: 200px;
`;

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ className }) => {
  const { analysisData } = useAudioAnalysis();
  
  const handleMicrophoneConnect = async () => {
    try {
      const { audioAnalyzer } = await import('../../services/audioAnalyzer');
      await audioAnalyzer.connectToMicrophone();
      console.log('🎤 Microphone connected successfully');
    } catch (error) {
      console.error('Failed to connect microphone:', error);
      alert('Failed to connect microphone. Please ensure you have granted microphone permissions.');
    }
  };
  
  return (
    <CanvasContainer className={className}>
      <AudioIndicator isActive={analysisData.isAnalyzing && analysisData.averageFrequency > 0}>
        {analysisData.isAnalyzing && analysisData.averageFrequency > 0 
          ? '🎵 Audio Detected' 
          : '🔇 No Audio'}
      </AudioIndicator>
      
      <MicButton onClick={handleMicrophoneConnect}>
        🎤 Use Microphone
      </MicButton>
      
      <DebugInfo>
        <div>Analyzing: {analysisData.isAnalyzing ? 'Yes' : 'No'}</div>
        <div>Avg Freq: {(analysisData.averageFrequency * 100).toFixed(1)}%</div>
        <div>Bass: {(analysisData.bassLevel * 100).toFixed(1)}%</div>
        <div>Treble: {(analysisData.trebleLevel * 100).toFixed(1)}%</div>
        <div>Bands: {analysisData.frequencyBands.length}</div>
        <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.7 }}>
          💡 Spotify blocks direct audio access for security. Use microphone to test!
        </div>
      </DebugInfo>
      
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0a0a0a']} />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

        <Suspense fallback={<LoadingFallback />}>
          <GridVisualizer />
        </Suspense>
      </Canvas>
    </CanvasContainer>
  );
};

export default VisualizerCanvas;