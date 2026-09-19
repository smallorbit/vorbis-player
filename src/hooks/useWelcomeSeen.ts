import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

/** Re-export for callers that still import the key string alongside the hook. */
export const WELCOME_SEEN_STORAGE_KEY = STORAGE_KEYS.WELCOME_SEEN;

export const useWelcomeSeen = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>(STORAGE_KEYS.WELCOME_SEEN, false);
};
