import React, { Suspense, useRef } from 'react';
import styled from 'styled-components';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
// import { useVisualizerStore } from '../../lib/visualizer/state';
import { AutoOrbitCameraControls } from './camera/AutoOrbitCamera';
import { CanvasBackground, BackgroundFog } from './canvas/common';
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

// Placeholder visualizer component - will be replaced by actual visualizers
const PlaceholderVisualizer = () => {
  const cubeRef = useRef<Mesh>(null);
  const sphereRef = useRef<Mesh>(null);
  const cylinderRef = useRef<Mesh>(null);
  const torusRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    // Rotate the cube
    if (cubeRef.current) {
      cubeRef.current.rotation.x = t * 0.5;
      cubeRef.current.rotation.y = t * 0.3;
    }
    
    // Float the sphere
    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(t * 2) * 2;
    }
    
    // Scale the cylinder
    if (cylinderRef.current) {
      cylinderRef.current.scale.y = 1 + Math.sin(t * 3) * 0.5;
    }
    
    // Rotate the torus
    if (torusRef.current) {
      torusRef.current.rotation.x = t * 0.2;
      torusRef.current.rotation.y = t * 0.4;
    }
  });

  return (
    <group>
      {/* Animated rotating cube */}
      <mesh ref={cubeRef} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#ff6b6b" />
      </mesh>
      
      {/* Floating sphere */}
      <mesh ref={sphereRef} position={[4, 0, 0]} castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#4ecdc4" />
      </mesh>
      
      {/* Pulsing cylinder */}
      <mesh ref={cylinderRef} position={[-4, 0, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 2, 32]} />
        <meshStandardMaterial color="#45b7d1" />
      </mesh>
      
      {/* Central wireframe torus for visual interest */}
      <mesh ref={torusRef}>
        <torusGeometry args={[3, 0.5, 16, 100]} />
        <meshStandardMaterial color="#ffffff" wireframe />
      </mesh>
    </group>
  );
};

const CanvasContainer = styled.div`
  width: 100%;
  height: 100%;
`;

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ className }) => {
  return (
    <CanvasContainer className={className}>
      <Canvas
        shadows
        camera={{ 
          position: [10, 5, 10], 
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]} // Device pixel ratio for better quality on high-DPI displays
      >
        {/* Background and fog */}
        <CanvasBackground />
        <BackgroundFog />
        
        {/* Lighting setup */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        {/* Camera controls */}
        <AutoOrbitCameraControls />
        
        {/* Manual orbit controls for user interaction */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
        
        {/* Scene content */}
        <Suspense fallback={<LoadingFallback />}>
          <Ground />
          <PlaceholderVisualizer />
        </Suspense>
      </Canvas>
    </CanvasContainer>
  );
};

export default VisualizerCanvas;
