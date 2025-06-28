import React from 'react';
import VisualizerCanvas from './VisualizerCanvas';
import { useVisualizerStore } from '../../lib/visualizer/state';

export const VisualizerTest: React.FC = () => {
  const { isVisualizerActive, setVisualizerActive } = useVisualizerStore();

  return (
    <div className="w-full h-screen bg-black">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setVisualizerActive(!isVisualizerActive)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isVisualizerActive ? 'Hide Visualizer' : 'Show Visualizer'}
        </button>
      </div>
      
      {isVisualizerActive && (
        <VisualizerCanvas className="absolute inset-0" />
      )}
      
      {!isVisualizerActive && (
        <div className="flex items-center justify-center h-full text-white">
          <p>Click "Show Visualizer" to see the 3D canvas</p>
        </div>
      )}
    </div>
  );
};