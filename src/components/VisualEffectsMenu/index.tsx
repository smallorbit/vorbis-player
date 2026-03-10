import React, { memo, useCallback, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { theme } from '../../styles/theme';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerSizing } from '../../hooks/usePlayerSizing';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { DropboxCatalogAdapter } from '@/providers/dropbox/dropboxCatalogAdapter';
import { ART_REFRESHED_EVENT } from '@/hooks/useLibrarySync';

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
  ResetButton,
  FilterGrid,
  ProviderButton,
  ProviderStatusDot,
  ProviderName,
  ProviderActiveLabel,
  CacheOptionsList,
  CacheOptionItem,
  CacheCheckbox,
  CacheOptionLabel,
  CacheConfirmButtons,
  CacheCancelButton,
  CollapsibleHeader,
  CollapsibleTitle,
  CollapsibleChevron,
  CollapsibleBody,
  CollapsibleInner,
} from './styled';

export interface ClearCacheOptions {
  clearLikes: boolean;
  clearPins: boolean;
  clearAccentColors: boolean;
}

interface AppSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  onClearCache: (options: ClearCacheOptions) => Promise<void>;
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

/** Music Sources section rendered at the top of the settings drawer. */
const MusicSourcesSection = memo(({ accentColor }: { accentColor: string }) => {
  const { activeProviderId, setActiveProviderId, registry } = useProviderContext();
  const providers = useMemo(() => registry.getAll(), [registry]);

  // Only show if there are 2+ providers registered
  if (providers.length < 2) return null;

  return (
    <FilterSection>
      <SectionTitle>Music Source</SectionTitle>
      <FilterGrid>
        {providers.map((descriptor) => {
          const isActive = descriptor.id === activeProviderId;
          const isConnected = descriptor.auth.isAuthenticated();
          return (
            <ProviderButton
              key={descriptor.id}
              $accentColor={accentColor}
              $isActive={isActive}
              onClick={() => {
                if (descriptor.id !== activeProviderId) {
                  setActiveProviderId(descriptor.id);
                  window.location.reload();
                }
              }}
              aria-label={`Switch to ${descriptor.name}`}
            >
              <ProviderStatusDot $isConnected={isConnected} $accentColor={accentColor} />
              <ProviderName>{descriptor.name}</ProviderName>
              {isActive && <ProviderActiveLabel>Active</ProviderActiveLabel>}
            </ProviderButton>
          );
        })}
      </FilterGrid>
    </FilterSection>
  );
});
MusicSourcesSection.displayName = 'MusicSourcesSection';

/** Chevron SVG used in collapsible section headers. */
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <CollapsibleChevron $isOpen={isOpen} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
  </CollapsibleChevron>
);

/** Reusable collapsible section wrapper. */
const CollapsibleSection = memo(({
  title,
  accentColor,
  defaultOpen = false,
  children,
}: {
  title: string;
  accentColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <FilterSection>
      <CollapsibleHeader
        $accentColor={accentColor}
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        <CollapsibleTitle>{title}</CollapsibleTitle>
        <ChevronIcon isOpen={isOpen} />
      </CollapsibleHeader>
      <CollapsibleBody $isOpen={isOpen}>
        <CollapsibleInner>
          {children}
        </CollapsibleInner>
      </CollapsibleBody>
    </FilterSection>
  );
});
CollapsibleSection.displayName = 'CollapsibleSection';

/** Dropbox-specific data management — art cache + liked songs. */
const DropboxDataSection = memo(({ accentColor, catalog }: { accentColor: string; catalog: DropboxCatalogAdapter }) => {
  const [artStatus, setArtStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [likesStatus, setLikesStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const artBusy = artStatus === 'working';
  const likesBusy = likesStatus === 'working';

  // Art cache handlers
  const handleClearArt = async () => {
    setArtStatus('working');
    await catalog.clearArtCache();
    setArtStatus('done');
    setTimeout(() => setArtStatus('idle'), 1500);
  };

  const handleRefreshArt = async () => {
    setArtStatus('working');
    const { clearCatalogCache } = await import('@/providers/dropbox/dropboxCatalogCache');
    await Promise.all([catalog.clearArtCache(), clearCatalogCache()]);
    window.dispatchEvent(new CustomEvent(ART_REFRESHED_EVENT));
    setArtStatus('done');
    setTimeout(() => setArtStatus('idle'), 1500);
  };

  // Liked songs handlers
  const handleExport = async () => {
    setLikesStatus('working');
    try {
      const json = await catalog.exportLikes();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vorbis-liked-songs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setResultMessage('Exported!');
    } catch {
      setResultMessage('Export failed');
    }
    setLikesStatus('done');
    setTimeout(() => { setLikesStatus('idle'); setResultMessage(''); }, 1500);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLikesStatus('working');
    try {
      const json = await file.text();
      const count = await catalog.importLikes(json);
      setResultMessage(`Imported ${count} tracks`);
    } catch {
      setResultMessage('Import failed');
    }
    setLikesStatus('done');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => { setLikesStatus('idle'); setResultMessage(''); }, 2000);
  };

  const handleRefreshMetadata = async () => {
    setLikesStatus('working');
    try {
      const result = await catalog.refreshLikedMetadata();
      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.removed > 0) parts.push(`${result.removed} removed`);
      setResultMessage(parts.length > 0 ? parts.join(', ') : 'No changes');
    } catch {
      setResultMessage('Refresh failed');
    }
    setLikesStatus('done');
    setTimeout(() => { setLikesStatus('idle'); setResultMessage(''); }, 2000);
  };

  return (
    <CollapsibleSection title="Dropbox Data" accentColor={accentColor}>
      <ControlGroup>
        <ControlLabel>Clear cached art so it re-downloads on next library load</ControlLabel>
        <ResetButton onClick={handleClearArt} $accentColor={accentColor} disabled={artBusy}>
          {artStatus === 'done' ? 'Cleared!' : artBusy ? 'Working…' : 'Clear Art Cache'}
        </ResetButton>
      </ControlGroup>
      <ControlGroup>
        <ControlLabel>Clear and immediately re-fetch fresh art in the background</ControlLabel>
        <ResetButton onClick={handleRefreshArt} $accentColor={accentColor} disabled={artBusy}>
          {artStatus === 'done' ? 'Started!' : artBusy ? 'Working…' : 'Refresh Art'}
        </ResetButton>
      </ControlGroup>
      <ControlGroup>
        <ControlLabel>Export liked songs to a JSON file for backup</ControlLabel>
        <ResetButton onClick={handleExport} $accentColor={accentColor} disabled={likesBusy}>
          {likesStatus === 'done' && resultMessage === 'Exported!' ? 'Exported!' : likesBusy ? 'Working…' : 'Export Likes'}
        </ResetButton>
      </ControlGroup>
      <ControlGroup>
        <ControlLabel>Import liked songs from a previously exported JSON file</ControlLabel>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
        <ResetButton onClick={() => fileInputRef.current?.click()} $accentColor={accentColor} disabled={likesBusy}>
          {likesStatus === 'done' && resultMessage.startsWith('Imported') ? resultMessage : likesBusy ? 'Working…' : 'Import Likes'}
        </ResetButton>
      </ControlGroup>
      <ControlGroup>
        <ControlLabel>Re-scan Dropbox to update metadata for liked tracks</ControlLabel>
        <ResetButton onClick={handleRefreshMetadata} $accentColor={accentColor} disabled={likesBusy}>
          {likesStatus === 'done' ? resultMessage || 'Done!' : likesBusy ? 'Scanning…' : 'Refresh Metadata'}
        </ResetButton>
      </ControlGroup>
    </CollapsibleSection>
  );
});
DropboxDataSection.displayName = 'DropboxDataSection';

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
  const { activeProviderId, activeDescriptor } = useProviderContext();
  const isDropbox = activeProviderId === 'dropbox';
  const dropboxCatalog = isDropbox
    ? (activeDescriptor?.catalog as DropboxCatalogAdapter | undefined)
    : undefined;
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
    setTimeout(() => setClearState('idle'), 1500);
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
          {/* Music Sources — always visible at top */}
          <MusicSourcesSection accentColor={accentColor} />

          {/* Dropbox Data — consolidated art cache + liked songs */}
          {dropboxCatalog && (
            <DropboxDataSection accentColor={accentColor} catalog={dropboxCatalog} />
          )}

          {/* Advanced — collapsible */}
          <CollapsibleSection title="Advanced" accentColor={accentColor}>
            <ControlGroup>
              <ControlLabel>Clear Library Cache</ControlLabel>
              {clearState === 'confirming' ? (
                <>
                  <CacheOptionsList>
                    {!isDropbox && (
                      <CacheOptionItem>
                        <CacheCheckbox
                          id="clear-likes"
                          type="checkbox"
                          checked={clearLikes}
                          onChange={(e) => setClearLikes(e.target.checked)}
                          $accentColor={accentColor}
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
                        $accentColor={accentColor}
                      />
                      <CacheOptionLabel htmlFor="clear-pins">Also clear Pins</CacheOptionLabel>
                    </CacheOptionItem>
                    <CacheOptionItem>
                      <CacheCheckbox
                        id="clear-accent-colors"
                        type="checkbox"
                        checked={clearAccentColors}
                        onChange={(e) => setClearAccentColors(e.target.checked)}
                        $accentColor={accentColor}
                      />
                      <CacheOptionLabel htmlFor="clear-accent-colors">Also clear Accent Colors</CacheOptionLabel>
                    </CacheOptionItem>
                  </CacheOptionsList>
                  <CacheConfirmButtons>
                    <CacheCancelButton onClick={handleClearCacheCancel} $accentColor={accentColor}>
                      Cancel
                    </CacheCancelButton>
                    <ResetButton onClick={handleClearCacheConfirm} $accentColor={accentColor}>
                      Confirm Clear
                    </ResetButton>
                  </CacheConfirmButtons>
                </>
              ) : (
                <ResetButton onClick={clearState === 'success' ? undefined : handleClearCacheClick} $accentColor={accentColor}>
                  {clearState === 'success' ? 'Cleared!' : 'Clear Cache'}
                </ResetButton>
              )}
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
          </CollapsibleSection>
        </DrawerContent>
      </DrawerContainer>
    </ProfiledComponent>,
    document.body
  );
}, arePropsEqual);

AppSettingsMenu.displayName = 'AppSettingsMenu';

export default AppSettingsMenu;
