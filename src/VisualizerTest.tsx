import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Mesh } from 'three';

// Simple test sphere component
const TestSphere = () => {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.5;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#4ecdc4" />
    </mesh>
  );
};

// Fallback component
const Fallback = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color="#333" wireframe />
  </mesh>
);

const VisualizerTest = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10 }}>
        <h1>3D Visualizer Test</h1>
        <p>Testing React Three Fiber in isolation</p>
      </div>
      
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0a0a0a']} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        
        <Suspense fallback={<Fallback />}>
          <TestSphere />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VisualizerTest;