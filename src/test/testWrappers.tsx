import React from 'react';
import { TrackProvider } from '@/contexts/TrackContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { VisualEffectsProvider } from '@/contexts/visualEffects';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';
import { ThemeProvider } from '@/styles/ThemeProvider';

export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
