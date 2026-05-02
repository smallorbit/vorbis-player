import { useCallback, useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useIsTouchDevice } from './useIsTouchDevice';

const PLACEHOLDER = 'Start typing to search your library';

export const CmdKPalette = (): JSX.Element | null => {
  const isTouch = useIsTouchDevice();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  }, []);

  useEffect(() => {
    if (isTouch) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTouch]);

  if (isTouch) return null;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <DialogDescription className="sr-only">
        Search across your music library.
      </DialogDescription>
      <CommandInput
        placeholder={PLACEHOLDER}
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
      </CommandList>
    </CommandDialog>
  );
};

export default CmdKPalette;
