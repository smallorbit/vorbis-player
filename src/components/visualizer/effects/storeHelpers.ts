import { useState, useCallback } from 'react';

// Simplified store system for visualizer configuration
export function createConfigStore<T extends Record<string, unknown>>(
  presets: Record<string, T>
) {
  const defaultPresetName = 'default';
  const defaultPreset = presets[defaultPresetName];

  return {
    useParams: () => {
      const [params, setParams] = useState<T>(defaultPreset);
      return params;
    },
    
    useActions: () => {
      const [params, setParams] = useState<T>(defaultPreset);
      const [activePreset, setActivePreset] = useState<string | undefined>(defaultPresetName);

      const updateParams = useCallback((newParams: Partial<T>) => {
        setParams(prev => ({ ...prev, ...newParams }));
        setActivePreset(undefined); // Switch to custom when manually updating
      }, []);

      const setPreset = useCallback((presetName: string | undefined) => {
        if (presetName && presets[presetName]) {
          setParams(presets[presetName]);
          setActivePreset(presetName);
        } else {
          setActivePreset(undefined);
        }
      }, []);

      return {
        setParams: updateParams,
        setPreset
      };
    },

    usePresets: () => {
      const [activePreset] = useState<string | undefined>(defaultPresetName);
      
      return {
        active: activePreset,
        options: presets
      };
    }
  };
}