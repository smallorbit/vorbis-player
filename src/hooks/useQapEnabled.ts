import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

export const useQapEnabled = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>(STORAGE_KEYS.QAP_ENABLED, false);
};
