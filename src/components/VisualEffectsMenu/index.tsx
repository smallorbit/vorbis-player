import React, { memo, useCallback, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { theme } from '../../styles/theme';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useProviderContext } from '@/contexts/ProviderContext';

import {
  DrawerOverlay,
  DrawerContainer,
  DrawerHeader,
  DrawerTitle,
  CloseButton,
  DrawerContent,
  ControlGroup,
  ControlLabel,
  OptionButtonGroup,
  OptionButton,
  ResetButton,
  CacheOptionsList,
  CacheOptionItem,
  CacheCheckbox,
  CacheOptionLabel,
  CacheConfirmButtons,
  CacheCancelButton,
} from './styled';

import { STATUS_RESET_DELAY_MS } from '@/constants/statusTiming';

import { MusicSourcesSection, NativeQueueSyncSection } from './SourcesSections';
import { ProviderDataSection } from './ProviderDataSection';
import { CollapsibleSection } from './CollapsibleSection';

export interface ClearCacheOptions {
  clearLikes: boolean;
  clearPins: boolean;
  clearAccentColors: boolean;
}

interface AppSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCache: (options: ClearCacheOptions) => Promise<void>;
  profilerEnabled: boolean;
  onProfilerToggle: () => void;
  visualizerDebugEnabled: boolean;
  onVisualizerDebugToggle: () => void;
  qapEnabled: boolean;
  onQapToggle: () => void;
}

const arePropsEqual = (
  prevProps: AppSettingsMenuProps,
  nextProps: AppSettingsMenuProps
): boolean => {
  if (
    prevProps.isOpen !== nextProps.isOpen ||
    prevProps.profilerEnabled !== nextProps.profilerEnabled ||
    prevProps.visualizerDebugEnabled !== nextProps.visualizerDebugEnabled ||
    prevProps.qapEnabled !== nextProps.qapEnabled
  ) {
    return false;
  }

  return true;
};

const AppSettingsMenu: React.FC<AppSettingsMenuProps> = memo(({
  isOpen,
  onClose,
  onClearCache,
  profilerEnabled,
  onProfilerToggle,
  visualizerDebugEnabled,
  onVisualizerDebugToggle,
  qapEnabled,
  onQapToggle,
}) => {
  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizingContext();
  const { enabledProviderIds, registry } = useProviderContext();
  const dataProviders = useMemo(() => {
    return registry.getAll().filter(
      (p) => enabledProviderIds.includes(p.id) && (p.catalog.clearArtCache || p.catalog.exportLikes),
    );
  }, [registry, enabledProviderIds]);
  const [clearState, setClearState] = useState<'idle' | 'confirming' | 'success'>('idle');
  const [clearLikes, setClearLikes] = useState(false);
  const [clearPins, setClearPins] = useState(false);
  const [clearAccentColors, setClearAccentColors] = useState(false);

  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs));
    if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet));
    return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop));
  }, [viewport.width, isMobile, isTablet]);

  const handleClearCacheClick = useCallback(() => {
    setClearState('confirming');
  }, []);

  const handleClearCacheCancel = useCallback(() => {
    setClearState('idle');
    setClearLikes(false);
    setClearPins(false);
    setClearAccentColors(false);
  }, []);

  const handleClearCacheConfirm = useCallback(async () => {
    await onClearCache({ clearLikes, clearPins, clearAccentColors });
    setClearState('success');
    setClearLikes(false);
    setClearPins(false);
    setClearAccentColors(false);
    setTimeout(() => setClearState('idle'), STATUS_RESET_DELAY_MS);
  }, [onClearCache, clearLikes, clearPins, clearAccentColors]);

  return createPortal(
    <ProfiledComponent id="app-settings-menu">
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} />
      <DrawerContainer
        $isOpen={isOpen}
        $width={drawerWidth}
        $transitionDuration={transitionDuration}
        $transitionEasing={transitionEasing}
      >
        <DrawerHeader>
          <DrawerTitle>Settings</DrawerTitle>
          <CloseButton onClick={onClose} aria-label="Close settings drawer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </DrawerHeader>

        <DrawerContent>
          <MusicSourcesSection />

          <NativeQueueSyncSection />

          <ControlGroup>
            <ControlLabel>Quick Access Panel</ControlLabel>
            <OptionButtonGroup>
              <OptionButton
                $isActive={qapEnabled}
                onClick={onQapToggle}
              >
                On
              </OptionButton>
              <OptionButton
                $isActive={!qapEnabled}
                onClick={onQapToggle}
              >
                Off
              </OptionButton>
            </OptionButtonGroup>
          </ControlGroup>

          <CollapsibleSection title="Advanced">
            <ControlGroup>
              <ControlLabel>Clear Library Cache</ControlLabel>
              {clearState === 'confirming' ? (
                <>
                  <CacheOptionsList>
                    {dataProviders.length === 0 && (
                      <CacheOptionItem>
                        <CacheCheckbox
                          id="clear-likes"
                          type="checkbox"
                          checked={clearLikes}
                          onChange={(e) => setClearLikes(e.target.checked)}
                        />
                        <CacheOptionLabel htmlFor="clear-likes">Also clear Likes</CacheOptionLabel>
                      </CacheOptionItem>
                    )}
                    <CacheOptionItem>
                      <CacheCheckbox
                        id="clear-pins"
                        type="checkbox"
                        checked={clearPins}
                        onChange={(e) => setClearPins(e.target.checked)}
                      />
                      <CacheOptionLabel htmlFor="clear-pins">Also clear Pins</CacheOptionLabel>
                    </CacheOptionItem>
                    <CacheOptionItem>
                      <CacheCheckbox
                        id="clear-accent-colors"
                        type="checkbox"
                        checked={clearAccentColors}
                        onChange={(e) => setClearAccentColors(e.target.checked)}
                      />
                      <CacheOptionLabel htmlFor="clear-accent-colors">Also clear Accent Colors</CacheOptionLabel>
                    </CacheOptionItem>
                  </CacheOptionsList>
                  <CacheConfirmButtons>
                    <CacheCancelButton onClick={handleClearCacheCancel}>
                      Cancel
                    </CacheCancelButton>
                    <ResetButton onClick={handleClearCacheConfirm}>
                      Confirm Clear
                    </ResetButton>
                  </CacheConfirmButtons>
                </>
              ) : (
                <ResetButton onClick={clearState === 'success' ? undefined : handleClearCacheClick}>
                  {clearState === 'success' ? 'Cleared!' : 'Clear Cache'}
                </ResetButton>
              )}
            </ControlGroup>
            <ControlGroup>
              <ControlLabel>Performance Profiler</ControlLabel>
              <OptionButtonGroup>
                <OptionButton
                  $isActive={profilerEnabled}
                  onClick={onProfilerToggle}
                >
                  On
                </OptionButton>
                <OptionButton
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
                  $isActive={visualizerDebugEnabled}
                  onClick={onVisualizerDebugToggle}
                >
                  On
                </OptionButton>
                <OptionButton
                  $isActive={!visualizerDebugEnabled}
                  onClick={onVisualizerDebugToggle}
                >
                  Off
                </OptionButton>
              </OptionButtonGroup>
            </ControlGroup>
            {dataProviders.map((p) => (
              <ProviderDataSection key={p.id} providerName={p.name} catalog={p.catalog} />
            ))}
          </CollapsibleSection>
        </DrawerContent>
      </DrawerContainer>
    </ProfiledComponent>,
    document.body
  );
}, arePropsEqual);

AppSettingsMenu.displayName = 'AppSettingsMenu';

export default AppSettingsMenu;
