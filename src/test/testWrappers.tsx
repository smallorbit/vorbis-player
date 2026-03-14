import React from 'react';
import { TrackProvider } from '@/contexts/TrackContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { VisualEffectsProvider } from '@/contexts/VisualEffectsContext';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';

export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProviderProvider>
      <PlayerSizingProvider>
        <TrackProvider>
          <ColorProvider>
            <VisualEffectsProvider>
              <PinnedItemsProvider>
                {children}
              </PinnedItemsProvider>
            </VisualEffectsProvider>
          </ColorProvider>
        </TrackProvider>
      </PlayerSizingProvider>
    </ProviderProvider>
  );
}
