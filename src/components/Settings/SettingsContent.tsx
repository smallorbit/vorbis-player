import React, { Suspense, lazy } from 'react';
import { X } from 'lucide-react';
import type { SettingsSectionId } from './sections';
import { SETTINGS_SECTIONS } from './sections';
import {
  ContentRoot,
  ContentBody,
  Header,
  HeaderTitle,
  IconButton,
  SectionTitle,
} from './styled';

// Lazy-load section bodies so the shell can mount (and unit-test) without
// eagerly pulling in the provider registry or profiling/visualizer contexts.
const SourcesSection = lazy(() =>
  import('./sections/SourcesSection').then((m) => ({ default: m.SourcesSection })),
);
const AdvancedSection = lazy(() =>
  import('./sections/AdvancedSection').then((m) => ({ default: m.AdvancedSection })),
);
const AppearanceSection = lazy(() =>
  import('./sections/AppearanceSection').then((m) => ({ default: m.AppearanceSection })),
);
const PlaybackSection = lazy(() =>
  import('./sections/PlaybackSection').then((m) => ({ default: m.PlaybackSection })),
);

interface SettingsContentProps {
  activeSection: SettingsSectionId;
  onClose: () => void;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection, onClose }) => {
  const section = SETTINGS_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_SECTIONS[0];

  return (
    <ContentRoot aria-labelledby="settings-v2-section-title">
      <Header>
        <HeaderTitle id="settings-v2-section-title">{section.label}</HeaderTitle>
        <IconButton type="button" onClick={onClose} aria-label="Close settings">
          <X width={18} height={18} aria-hidden="true" />
        </IconButton>
      </Header>
      <ContentBody>
        <SettingsSectionBody activeSection={activeSection} />
      </ContentBody>
    </ContentRoot>
  );
};

/**
 * Maps a section ID to the live-content component. The Settings v2 taxonomy
 * is complete as of phase 4 (#1452): Sources / Playback / Appearance / Advanced.
 */
export const SettingsSectionBody: React.FC<{ activeSection: SettingsSectionId }> = ({ activeSection }) => {
  const section = SETTINGS_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_SECTIONS[0];

  switch (activeSection) {
    case 'sources':
      return (
        <Suspense fallback={<SectionTitle>{section.label}</SectionTitle>}>
          <SourcesSection />
        </Suspense>
      );
    case 'advanced':
      return (
        <Suspense fallback={<SectionTitle>{section.label}</SectionTitle>}>
          <AdvancedSection />
        </Suspense>
      );
    case 'appearance':
      return (
        <Suspense fallback={<SectionTitle>{section.label}</SectionTitle>}>
          <AppearanceSection />
        </Suspense>
      );
    case 'playback':
    default:
      return (
        <Suspense fallback={<SectionTitle>{section.label}</SectionTitle>}>
          <PlaybackSection />
        </Suspense>
      );
  }
};
