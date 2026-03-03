import React from 'react';
import { TrackProvider } from '@/contexts/TrackContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { VisualEffectsProvider } from '@/contexts/VisualEffectsContext';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';
import { ProviderProvider } from '@/contexts/ProviderContext';

export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProviderProvider>
      <TrackProvider>
        <ColorProvider>
          <VisualEffectsProvider>
            <PinnedItemsProvider>
              {children}
            </PinnedItemsProvider>
          </VisualEffectsProvider>
        </ColorProvider>
      </TrackProvider>
    </ProviderProvider>
  );
}

