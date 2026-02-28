import React from 'react';
import { TrackProvider } from '@/contexts/TrackContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { VisualEffectsProvider } from '@/contexts/VisualEffectsContext';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';

export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TrackProvider>
      <ColorProvider>
        <VisualEffectsProvider>
          <PinnedItemsProvider>
            {children}
          </PinnedItemsProvider>
        </VisualEffectsProvider>
      </ColorProvider>
    </TrackProvider>
  );
}

