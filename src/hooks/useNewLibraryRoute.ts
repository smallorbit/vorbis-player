import { useLocalStorage } from '@/hooks/useLocalStorage';

export const useNewLibraryRoute = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>('vorbis-player-new-library-route', false);
};
