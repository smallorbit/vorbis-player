import React from 'react';
import type { SettingsSectionId } from './sections';
import { SETTINGS_SECTIONS } from './sections';
import { SidebarRoot, SidebarHeader, SidebarItem } from './styled';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, onSelect }) => {
  return (
    <SidebarRoot aria-label="Settings sections">
      <SidebarHeader>Settings</SidebarHeader>
      {SETTINGS_SECTIONS.map((section) => (
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
