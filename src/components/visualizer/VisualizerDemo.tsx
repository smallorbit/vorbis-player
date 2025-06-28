import { useEffect, useState } from 'react';
import { useVisualizerStore } from '../../lib/visualizer/state';
import { SpotifyAudioBridge } from './SpotifyAudioBridge';
import type FFTAnalyzer from '../../lib/visualizer/analyzers/fft';

/**
 * Demo component showing how to integrate the Spotify Audio Bridge
 * with visualizers and access real-time frequency data.
 */
export default function VisualizerDemo() {
  const {
    viewMode,
    isVisualizerActive,
    frequencyData,
    isAudioCaptureActive,
    setVisualizerActive,
    toggleViewMode
  } = useVisualizerStore();

  const [analyzer, setAnalyzer] = useState<FFTAnalyzer | null>(null);

  // Handle analyzer ready callback
  const handleAnalyzerReady = (fftAnalyzer: FFTAnalyzer) => {
    console.log('FFT Analyzer is ready:', fftAnalyzer);
    setAnalyzer(fftAnalyzer);
  };

  // Log frequency data updates for demo purposes
  useEffect(() => {
    if (frequencyData.length > 0) {
      // Calculate some basic metrics for visualization
      const bassEnergy = frequencyData.slice(0, 8).reduce((sum, bin) => sum + bin.value, 0) / 8;
      const midEnergy = frequencyData.slice(8, 24).reduce((sum, bin) => sum + bin.value, 0) / 16;
      const trebleEnergy = frequencyData.slice(24).reduce((sum, bin) => sum + bin.value, 0) / (frequencyData.length - 24);
      
      console.log('Audio metrics:', { bassEnergy, midEnergy, trebleEnergy });
    }
  }, [frequencyData]);

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Visualizer Demo</h3>
      
      {/* Audio Bridge - This component doesn't render anything visible */}
      <SpotifyAudioBridge onAnalyzerReady={handleAnalyzerReady} />
      
      {/* Control Panel */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setVisualizerActive(!isVisualizerActive)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isVisualizerActive
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            {isVisualizerActive ? 'Stop Visualizer' : 'Start Visualizer'}
          </button>
          
          <button
            onClick={toggleViewMode}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Switch to {viewMode === 'playlist' ? 'Visualizer' : 'Playlist'}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">View Mode:</span> {viewMode}
          </div>
          <div>
            <span className="font-medium">Visualizer Active:</span>{' '}
            <span className={isVisualizerActive ? 'text-green-600' : 'text-red-600'}>
              {isVisualizerActive ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="font-medium">Audio Capture:</span>{' '}
            <span className={isAudioCaptureActive ? 'text-green-600' : 'text-red-600'}>
              {isAudioCaptureActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div>
            <span className="font-medium">Frequency Bands:</span> {frequencyData.length}
          </div>
        </div>
      </div>

      {/* Audio Visualization Preview */}
      {isVisualizerActive && isAudioCaptureActive && frequencyData.length > 0 && (
        <div className="bg-black p-4 rounded-lg">
          <h4 className="text-white mb-2">Real-time Frequency Data</h4>
          <div className="flex items-end space-x-1 h-32">
            {frequencyData.slice(0, 32).map((bin, index) => (
              <div
                key={index}
                className="bg-gradient-to-t from-blue-500 to-purple-500 min-w-[4px] transition-all duration-75"
                style={{
                  height: `${Math.max(2, bin.value * 100)}%`,
                  opacity: 0.7 + bin.value * 0.3
                }}
                title={`Freq: ${bin.freqLo.toFixed(0)}-${bin.freqHi.toFixed(0)}Hz, Value: ${bin.value.toFixed(3)}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Analyzer Information */}
      {analyzer && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
          <h4 className="font-medium mb-2">Analyzer Info</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>FFT Size: {analyzer['_analyzer'].fftSize}</div>
            <div>Sample Rate: {analyzer['_audioCtx'].sampleRate}Hz</div>
            <div>Frequency Bins: {analyzer['_freqBinInfos'].length}</div>
            <div>Octave Mode: {analyzer.mode}</div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
        <h4 className="font-medium mb-2">How to Use:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Start the visualizer and grant microphone/screen capture permissions</li>
          <li>Play music through Spotify</li>
          <li>Watch the real-time frequency analysis in the visualization above</li>
          <li>Use the frequency data from the Zustand store to build custom visualizers</li>
        </ol>
      </div>
    </div>
  );
}