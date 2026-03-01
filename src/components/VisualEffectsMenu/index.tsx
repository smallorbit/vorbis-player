import React, { memo, useCallback, useState, useMemo } from 'react';

import { theme } from '../../styles/theme';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerSizing } from '../../hooks/usePlayerSizing';

import {
  DrawerOverlay,
  DrawerContainer,
  DrawerHeader,
  DrawerTitle,
  CloseButton,
  DrawerContent,
  FilterSection,
  SectionTitle,
  ControlGroup,
  ControlLabel,
  OptionButtonGroup,
  OptionButton,
  ResetButton
} from './styled';

interface AppSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  onClearCache: () => Promise<void>;
  profilerEnabled: boolean;
  onProfilerToggle: () => void;
  visualizerDebugEnabled: boolean;
  onVisualizerDebugToggle: () => void;
}

const arePropsEqual = (
  prevProps: AppSettingsMenuProps,
  nextProps: AppSettingsMenuProps
): boolean => {
  if (
    prevProps.isOpen !== nextProps.isOpen ||
    prevProps.accentColor !== nextProps.accentColor ||
    prevProps.profilerEnabled !== nextProps.profilerEnabled ||
    prevProps.visualizerDebugEnabled !== nextProps.visualizerDebugEnabled
  ) {
    return false;
  }

  return true;
};

const AppSettingsMenu: React.FC<AppSettingsMenuProps> = memo(({
  isOpen,
  onClose,
  accentColor,
  onClearCache,
  profilerEnabled,
  onProfilerToggle,
  visualizerDebugEnabled,
  onVisualizerDebugToggle
}) => {
  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();
  const [clearState, setClearState] = useState<'idle' | 'success'>('idle');

  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs));
    if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet));
    return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop));
  }, [viewport.width, isMobile, isTablet]);

  const handleClearCache = useCallback(async () => {
    await onClearCache();
    setClearState('success');
    setTimeout(() => setClearState('idle'), 1500);
  }, [onClearCache]);

  return (
    <ProfiledComponent id="app-settings-menu">
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
      <DrawerContainer
        $isOpen={isOpen}
        $width={drawerWidth}
        $transitionDuration={transitionDuration}
        $transitionEasing={transitionEasing}
      >
        <DrawerHeader>
          <DrawerTitle>App Settings</DrawerTitle>
          <CloseButton onClick={onClose} aria-label="Close app settings drawer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </DrawerHeader>

        <DrawerContent>
          <FilterSection>
            <SectionTitle>Advanced</SectionTitle>
            <ControlGroup>
              <ControlLabel>Clear Library Cache</ControlLabel>
              <ResetButton onClick={handleClearCache} $accentColor={accentColor}>
                {clearState === 'success' ? 'Cleared!' : 'Clear Cache'}
              </ResetButton>
            </ControlGroup>
            <ControlGroup>
              <ControlLabel>Performance Profiler</ControlLabel>
              <OptionButtonGroup>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={profilerEnabled}
                  onClick={onProfilerToggle}
                >
                  On
                </OptionButton>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={!profilerEnabled}
                  onClick={onProfilerToggle}
                >
                  Off
                </OptionButton>
              </OptionButtonGroup>
            </ControlGroup>
            <ControlGroup>
              <ControlLabel>Visualizer Debug</ControlLabel>
              <OptionButtonGroup>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={visualizerDebugEnabled}
                  onClick={onVisualizerDebugToggle}
                >
                  On
                </OptionButton>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={!visualizerDebugEnabled}
                  onClick={onVisualizerDebugToggle}
                >
                  Off
                </OptionButton>
              </OptionButtonGroup>
            </ControlGroup>
          </FilterSection>
        </DrawerContent>
      </DrawerContainer>
    </ProfiledComponent>
  );
}, arePropsEqual);

AppSettingsMenu.displayName = 'AppSettingsMenu';

export default AppSettingsMenu;
