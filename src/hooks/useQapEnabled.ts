import { useLocalStorage } from '@/hooks/useLocalStorage';

export const useQapEnabled = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>('vorbis-player-qap-enabled', false);
};
