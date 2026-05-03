import React from 'react';
import { X } from 'lucide-react';
import type { SettingsV2SectionId } from './sections';
import { SETTINGS_V2_SECTIONS } from './sections';
import { SettingsV2SectionBody } from './SettingsV2Content';
import {
  Header,
  HeaderTitle,
  IconButton,
  MobileSectionList,
  MobileSectionRow,
  MobileChevron,
  MobileDetailBody,
} from './styled';

interface SettingsV2MobileTakeoverProps {
  activeSection: SettingsV2SectionId | null;
  onSelectSection: (section: SettingsV2SectionId) => void;
  onBackToList: () => void;
  onClose: () => void;
}

export const SettingsV2MobileTakeover: React.FC<SettingsV2MobileTakeoverProps> = ({
  activeSection,
  onSelectSection,
  onBackToList,
  onClose,
}) => {
  if (activeSection === null) {
    return (
      <>
        <Header>
          <HeaderTitle>Settings</HeaderTitle>
          <IconButton type="button" onClick={onClose} aria-label="Close settings">
            <X width={18} height={18} aria-hidden="true" />
          </IconButton>
        </Header>
        <MobileSectionList aria-label="Settings sections">
          {SETTINGS_V2_SECTIONS.map((section) => (
            <MobileSectionRow
              key={section.id}
              type="button"
              onClick={() => onSelectSection(section.id)}
            >
              <span>{section.label}</span>
              <MobileChevron aria-hidden="true">›</MobileChevron>
            </MobileSectionRow>
          ))}
        </MobileSectionList>
      </>
    );
  }

  const section = SETTINGS_V2_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_V2_SECTIONS[0];

  return (
    <>
      <Header>
        <IconButton type="button" onClick={onBackToList} aria-label="Back to settings list">
          <BackChevronIcon />
        </IconButton>
        <HeaderTitle>{section.label}</HeaderTitle>
        <IconButton type="button" onClick={onClose} aria-label="Close settings">
          <X width={18} height={18} aria-hidden="true" />
        </IconButton>
      </Header>
      <MobileDetailBody>
        <SettingsV2SectionBody activeSection={activeSection} />
      </MobileDetailBody>
    </>
  );
};

const BackChevronIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
