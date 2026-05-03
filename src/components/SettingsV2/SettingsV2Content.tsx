import React from 'react';
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
        <SectionTitle>{section.label}</SectionTitle>
        <SectionPlaceholder>{section.description}</SectionPlaceholder>
      </ContentBody>
    </ContentRoot>
  );
};

