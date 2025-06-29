import React, { Suspense, useRef, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Matrix4, Vector3, Quaternion } from 'three';
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

// Audio-reactive grid visualizer matching r3f-audio-visualizer pattern
const GridVisualizer = () => {
  const meshRef = useRef<any>(null);
  const tmpMatrix = useMemo(() => new Matrix4(), []);

  // Grid configuration matching the reference
  const nGridRows = 100;
  const nGridCols = 100;
  const cubeSideLength = 0.025;
  const cubeSpacingScalar = 3;
  const totalCubes = nGridRows * nGridCols;

  // Coordinate mapper function (simplified version)
  const coordinateMapper = (normGridX: number, normGridY: number, time: number) => {
    // Create wave patterns similar to audio frequency data
    const wave1 = Math.sin(time * 2 + normGridX * 10) * 0.3;
    const wave2 = Math.sin(time * 1.5 + normGridY * 8) * 0.2;
    const wave3 = Math.sin(time * 3 + (normGridX + normGridY) * 6) * 0.4;

    // Radial component
    const centerDistance = Math.hypot(normGridX - 0.5, normGridY - 0.5);
    const radialWave = Math.sin(time * 1.8 + centerDistance * 12) * 0.5;

    return (wave1 + wave2 + wave3 + radialWave) * 0.8;
  };

  // Color setup based on radial distance
  const getColor = (normRadialOffset: number) => {
    // Simple color gradient from center to edge
    const hue = 0.5 + normRadialOffset * 0.3; // Teal to blue range
    const saturation = 0.8;
    const lightness = 0.6 + normRadialOffset * 0.2;

    return {
      r: lightness,
      g: lightness * 0.8,
      b: lightness * 1.2
    };
  };

  // Initialize colors
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
  }, [nGridRows, nGridCols]);

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

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ className }) => {
  return (
    <CanvasContainer className={className}>
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