import React from 'react';
import { ChevronLeftIcon } from '@/components/icons/ActionIcons';
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
          <ChevronLeftIcon />
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

