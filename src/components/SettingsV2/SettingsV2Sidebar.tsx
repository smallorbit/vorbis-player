import React from 'react';
import type { SettingsV2SectionId } from './sections';
import { SETTINGS_V2_SECTIONS } from './sections';
import { SidebarRoot, SidebarHeader, SidebarItem } from './styled';

interface SettingsV2SidebarProps {
  activeSection: SettingsV2SectionId;
  onSelect: (section: SettingsV2SectionId) => void;
}

export const SettingsV2Sidebar: React.FC<SettingsV2SidebarProps> = ({ activeSection, onSelect }) => {
  return (
    <SidebarRoot aria-label="Settings sections">
      <SidebarHeader>Settings</SidebarHeader>
      {SETTINGS_V2_SECTIONS.map((section) => (
        <SidebarItem
          key={section.id}
          type="button"
          $active={section.id === activeSection}
          aria-current={section.id === activeSection ? 'page' : undefined}
          onClick={() => onSelect(section.id)}
        >
          {section.label}
        </SidebarItem>
      ))}
    </SidebarRoot>
  );
};
