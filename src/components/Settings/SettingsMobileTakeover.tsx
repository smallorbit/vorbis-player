import React from 'react';
import { X } from 'lucide-react';
import type { SettingsSectionId } from './sections';
import { SETTINGS_SECTIONS } from './sections';
import { SettingsSectionBody } from './SettingsContent';
import {
  Header,
  HeaderTitle,
  IconButton,
  MobileSectionList,
  MobileSectionRow,
  MobileChevron,
  MobileDetailBody,
} from './styled';

interface SettingsMobileTakeoverProps {
  activeSection: SettingsSectionId | null;
  onSelectSection: (section: SettingsSectionId) => void;
  onBackToList: () => void;
  onClose: () => void;
}

export const SettingsMobileTakeover: React.FC<SettingsMobileTakeoverProps> = ({
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
          {SETTINGS_SECTIONS.map((section) => (
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

  const section = SETTINGS_SECTIONS.find((entry) => entry.id === activeSection) ?? SETTINGS_SECTIONS[0];

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
        <SettingsSectionBody activeSection={activeSection} />
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
