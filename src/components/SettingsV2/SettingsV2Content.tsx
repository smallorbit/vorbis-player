import React, { Suspense, lazy } from 'react';
import { X } from 'lucide-react';
import type { SettingsV2SectionId } from './sections';
import { SETTINGS_V2_SECTIONS } from './sections';
import {
  ContentRoot,
  ContentBody,
  Header,
  HeaderTitle,
  IconButton,
  SectionTitle,
  SectionPlaceholder,
} from './styled';

// Lazy-load section bodies so the shell can mount (and unit-test) without
// eagerly pulling in the provider registry, profiling/visualizer contexts,
// or the legacy AppSettingsMenu module graph.
const SourcesSection = lazy(() =>
  import('./sections/SourcesSection').then((m) => ({ default: m.SourcesSection })),
);
const AdvancedSection = lazy(() =>
  import('./sections/AdvancedSection').then((m) => ({ default: m.AdvancedSection })),
);

interface SettingsV2ContentProps {
  activeSection: SettingsV2SectionId;
  onClose: () => void;
}

export const SettingsV2Content: React.FC<SettingsV2ContentProps> = ({ activeSection, onClose }) => {
  const section = SETTINGS_V2_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_V2_SECTIONS[0];

  return (
    <ContentRoot aria-labelledby="settings-v2-section-title">
      <Header>
        <HeaderTitle id="settings-v2-section-title">{section.label}</HeaderTitle>
        <IconButton type="button" onClick={onClose} aria-label="Close settings">
          <X width={18} height={18} aria-hidden="true" />
        </IconButton>
      </Header>
      <ContentBody>
        <SettingsV2SectionBody activeSection={activeSection} />
      </ContentBody>
    </ContentRoot>
  );
};

/**
 * Maps a section ID to the live-content component, or to a placeholder for
 * sections still scheduled for future phases. Phase 2 (#1450) ships
 * `sources` + `advanced`; `playback` (#1452) and `appearance` (#1451) keep
 * the placeholder treatment from phase 1.
 */
export const SettingsV2SectionBody: React.FC<{ activeSection: SettingsV2SectionId }> = ({ activeSection }) => {
  switch (activeSection) {
    case 'sources':
      return (
        <Suspense fallback={null}>
          <SourcesSection />
        </Suspense>
      );
    case 'advanced':
      return (
        <Suspense fallback={null}>
          <AdvancedSection />
        </Suspense>
      );
    case 'playback':
    case 'appearance':
    default: {
      const section = SETTINGS_V2_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_V2_SECTIONS[0];
      return (
        <>
          <SectionTitle>{section.label}</SectionTitle>
          <SectionPlaceholder>{section.description}</SectionPlaceholder>
        </>
      );
    }
  }
};
