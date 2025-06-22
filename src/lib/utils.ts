import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Track } from '../services/dropbox';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sortTracksByNumber = (tracks: Track[]): Track[] => {
  return [...tracks].sort((a, b) => {
    const aMatch = a.title.match(/^(\d+)/);
    const bMatch = b.title.match(/^(\d+)/);
    
    if (aMatch && bMatch) {
      const aNum = parseInt(aMatch[1], 10);
      const bNum = parseInt(bMatch[1], 10);
      return aNum - bNum;
    }
    
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    
    return a.title.localeCompare(b.title);
  });
}; 