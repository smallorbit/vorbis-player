import { useLocalStorage } from '@/hooks/useLocalStorage';

export const WELCOME_SEEN_STORAGE_KEY = 'vorbis-player-welcome-seen';

export const useWelcomeSeen = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>(WELCOME_SEEN_STORAGE_KEY, false);
};
