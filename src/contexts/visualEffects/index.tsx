import React from 'react';
import { VisualEffectsToggleProvider } from './VisualEffectsToggleContext';
import { AccentColorBackgroundProvider } from './AccentColorBackgroundContext';
import { VisualizerProvider } from './VisualizerContext';
import { TranslucenceProvider } from './TranslucenceContext';
import { ZenModeProvider } from './ZenModeContext';
import { GlowProvider } from './GlowContext';

export { VisualEffectsToggleProvider, useVisualEffectsToggle } from './VisualEffectsToggleContext';
export { VisualizerProvider, useVisualizer } from './VisualizerContext';
export { useAccentColorBackground } from './AccentColorBackgroundContext';
export { TranslucenceProvider, useTranslucence } from './TranslucenceContext';
export { useZenMode } from './ZenModeContext';

export function VisualEffectsProvider({ children }: { children: React.ReactNode }) {
  return (
    <VisualEffectsToggleProvider>
      <AccentColorBackgroundProvider>
        <VisualizerProvider>
          <TranslucenceProvider>
            <ZenModeProvider>
              <GlowProvider>{children}</GlowProvider>
            </ZenModeProvider>
          </TranslucenceProvider>
        </VisualizerProvider>
      </AccentColorBackgroundProvider>
    </VisualEffectsToggleProvider>
  );
}
