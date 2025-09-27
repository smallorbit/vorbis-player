import { useState, useCallback } from 'react';

export interface ProfilerData {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: Set<unknown>;
}

/**
 * Hook for accessing profile data
 */
export const useProfilerData = (id: string) => {
  const [data, setData] = useState<ProfilerData[]>([]);

  const addProfileData = useCallback((profileData: ProfilerData) => {
    if (profileData.id === id) {
      setData(prev => [...prev.slice(-9), profileData]);
    }
  }, [id]);

  const getAverageRenderTime = useCallback(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.actualDuration, 0) / data.length;
  }, [data]);

  const getLastRenderTime = useCallback(() => {
    return data.length > 0 ? data[data.length - 1].actualDuration : 0;
  }, [data]);

  const getSlowRenders = useCallback((threshold = 16.67) => {
    return data.filter(d => d.actualDuration > threshold);
  }, [data]);

  return {
    data,
    addProfileData,
    getAverageRenderTime,
    getLastRenderTime,
    getSlowRenders,
    clear: () => setData([])
  };
};