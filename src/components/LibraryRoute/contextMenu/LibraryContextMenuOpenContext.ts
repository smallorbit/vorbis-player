import { createContext, useContext } from 'react';

export const LibraryContextMenuOpenContext = createContext<string | null>(null);

export const useLibraryContextMenuOpen = (): string | null =>
  useContext(LibraryContextMenuOpenContext);
