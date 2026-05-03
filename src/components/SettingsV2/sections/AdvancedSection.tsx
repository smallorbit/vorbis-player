import React, { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { useProviderContext } from '@/contexts/ProviderContext';
import { useProfilingContext } from '@/contexts/ProfilingContext';
import { useVisualizerDebug } from '@/contexts/VisualizerDebugContext';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ART_REFRESHED_EVENT } from '@/hooks/useLibrarySync';
import { clearCacheWithOptions } from '@/services/cache/libraryCache';
import { clearAllPins } from '@/services/settings/pinnedItemsStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { STATUS_RESET_DELAY_MS } from '@/constants/statusTiming';
import type { CatalogProvider } from '@/types/providers';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

/**
 * SettingsV2 Advanced section — phase 2 port (#1450).
 *
 * Ports the legacy AppSettingsMenu controls into v2 chrome (neutral shadcn
 * palette only — no `var(--accent-color)` references). Each control reads /
 * writes the same hook + storage key as the v1 surface, so toggling in
 * either UI reflects in the other immediately:
 *
 *   - Quick Access Panel ↔ `useQapEnabled()` ↔ `vorbis-player-qap-enabled`
 *   - Performance Profiler ↔ `useProfilingContext()` ↔ `STORAGE_KEYS.PROFILING`
 *   - Visualizer Debug ↔ `useVisualizerDebug()` (in-memory; toggling has no
 *     localStorage side-effect by design)
 *   - Clear Library Cache → `clearCacheWithOptions()` + `clearAllPins()` +
 *     accent-overrides cleanup (mirrors `PlayerControlsSection.handleClearCache`).
 */

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const ControlBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;

const ControlLabelText = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: hsl(var(--foreground));
  font-weight: ${({ theme }) => theme.fontWeight.medium};
`;

const ControlHelp = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
`;

const SectionGroupTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  color: hsl(var(--foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Divider = styled.div`
  border-top: 1px solid hsl(var(--border));
`;

const CacheOptionList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CacheOptionItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CacheCheckbox = styled.input`
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: hsl(var(--input));
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition: all ${({ theme }) => theme.transitions.fast};

  &:checked {
    background: hsl(var(--primary));
    border-color: hsl(var(--primary));
  }

  &:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: 2px solid hsl(var(--primary-foreground));
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

const CacheButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ShortcutHintList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ShortcutHintRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--muted-foreground));
`;

const Kbd = styled.kbd`
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: hsl(var(--foreground));
`;

interface ProviderDataBlockProps {
  providerName: string;
  catalog: CatalogProvider;
}

const ProviderDataBlock: React.FC<ProviderDataBlockProps> = ({ providerName, catalog }) => {
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasArtCache = !!catalog.clearArtCache;
  const hasRefreshArt = !!catalog.refreshArtCache;
  const hasLikesManagement = !!catalog.exportLikes && !!catalog.importLikes;
  const hasMetadataRefresh = !!catalog.refreshLikedMetadata;

  const clearResultMessage = useCallback(() => setResultMessage(''), []);

  const clearArtFn = useCallback(async () => {
    await catalog.clearArtCache?.();
  }, [catalog]);

  const refreshArtFn = useCallback(async () => {
    await catalog.refreshArtCache?.();
    window.dispatchEvent(new CustomEvent(ART_REFRESHED_EVENT));
  }, [catalog]);

  const exportFn = useCallback(async () => {
    try {
      const json = await catalog.exportLikes!();
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
  }, [catalog]);

  const refreshMetadataFn = useCallback(async () => {
    try {
      const result = await catalog.refreshLikedMetadata!();
      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.removed > 0) parts.push(`${result.removed} removed`);
      setResultMessage(parts.length > 0 ? parts.join(', ') : 'No changes');
    } catch {
      setResultMessage('Refresh failed');
    }
  }, [catalog]);

  const [clearArtStatus, runClearArt] = useAsyncAction(clearArtFn);
  const [refreshArtStatus, runRefreshArt] = useAsyncAction(refreshArtFn);
  const [exportStatus, runExport] = useAsyncAction(exportFn, { onReset: clearResultMessage });
  const [metadataStatus, runRefreshMetadata] = useAsyncAction(refreshMetadataFn, { onReset: clearResultMessage });
  const [importStatus, setImportStatus] = useState<'idle' | 'working' | 'done'>('idle');

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('working');
    try {
      const json = await file.text();
      const count = await catalog.importLikes!(json);
      setResultMessage(`Imported ${count} tracks`);
    } catch {
      setResultMessage('Import failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportStatus('done');
    setTimeout(() => { setImportStatus('idle'); setResultMessage(''); }, STATUS_RESET_DELAY_MS);
  }, [catalog]);

  const artBusy = clearArtStatus === 'working' || refreshArtStatus === 'working';
  const likesBusy = exportStatus === 'working' || importStatus === 'working' || metadataStatus === 'working';

  return (
    <AccordionItem value={`${providerName.toLowerCase()}-data`}>
      <AccordionTrigger>{`${providerName} Data`}</AccordionTrigger>
      <AccordionContent>
        <ControlBlock>
          {hasArtCache && (
            <ControlRow>
              <ControlHelp>Clear cached art so it re-downloads on next library load</ControlHelp>
              <Button variant="outline" size="sm" onClick={runClearArt} disabled={artBusy}>
                {clearArtStatus === 'done' ? 'Cleared!' : artBusy ? 'Working…' : 'Clear Art Cache'}
              </Button>
            </ControlRow>
          )}
          {hasRefreshArt && (
            <ControlRow>
              <ControlHelp>Clear and immediately re-fetch fresh art in the background</ControlHelp>
              <Button variant="outline" size="sm" onClick={runRefreshArt} disabled={artBusy}>
                {refreshArtStatus === 'done' ? 'Started!' : artBusy ? 'Working…' : 'Refresh Art'}
              </Button>
            </ControlRow>
          )}
          {hasLikesManagement && (
            <>
              <ControlRow>
                <ControlHelp>Export liked songs to a JSON file for backup</ControlHelp>
                <Button variant="outline" size="sm" onClick={runExport} disabled={likesBusy}>
                  {exportStatus === 'done' && resultMessage === 'Exported!' ? 'Exported!' : likesBusy ? 'Working…' : 'Export Likes'}
                </Button>
              </ControlRow>
              <ControlRow>
                <ControlHelp>Import liked songs from a previously exported JSON file</ControlHelp>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={likesBusy}>
                  {importStatus === 'done' && resultMessage.startsWith('Imported') ? resultMessage : likesBusy ? 'Working…' : 'Import Likes'}
                </Button>
              </ControlRow>
            </>
          )}
          {hasMetadataRefresh && (
            <ControlRow>
              <ControlHelp>Re-scan {providerName} to update metadata for liked tracks</ControlHelp>
              <Button variant="outline" size="sm" onClick={runRefreshMetadata} disabled={likesBusy}>
                {metadataStatus === 'done' ? resultMessage || 'Done!' : likesBusy ? 'Scanning…' : 'Refresh Metadata'}
              </Button>
            </ControlRow>
          )}
        </ControlBlock>
      </AccordionContent>
    </AccordionItem>
  );
};

export const AdvancedSection: React.FC = () => {
  const { enabledProviderIds, registry } = useProviderContext();
  const { enabled: profilerEnabled, toggle: profilerToggle } = useProfilingContext();
  const vizDebugCtx = useVisualizerDebug();
  const visualizerDebugEnabled = vizDebugCtx?.isDebugMode ?? false;
  const [qapEnabled, setQapEnabled] = useQapEnabled();

  const dataProviders = useMemo(() => {
    return registry.getAll().filter(
      (p) => enabledProviderIds.includes(p.id) && (p.catalog.clearArtCache || p.catalog.exportLikes),
    );
  }, [registry, enabledProviderIds]);

  const [clearState, setClearState] = useState<'idle' | 'confirming' | 'success'>('idle');
  const [clearLikes, setClearLikes] = useState(false);
  const [clearPins, setClearPins] = useState(false);
  const [clearAccentColors, setClearAccentColors] = useState(false);

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
    await clearCacheWithOptions({ clearLikes });
    if (clearPins) {
      await clearAllPins();
    }
    if (clearAccentColors) {
      localStorage.removeItem(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_ACCENT_COLORS);
    }
    if (clearPins || clearAccentColors) {
      const { clearPreferencesSyncTimestamp, getPreferencesSync } =
        await import('@/providers/dropbox/dropboxPreferencesSync');
      clearPreferencesSyncTimestamp();
      getPreferencesSync()?.initialSync();
    }
    setClearState('success');
    setClearLikes(false);
    setClearPins(false);
    setClearAccentColors(false);
    setTimeout(() => setClearState('idle'), STATUS_RESET_DELAY_MS);
  }, [clearLikes, clearPins, clearAccentColors]);

  const handleProfilerToggle = useCallback(() => {
    if (!profilerEnabled) {
      vizDebugCtx?.setIsDebugMode(false);
    }
    profilerToggle();
  }, [profilerEnabled, profilerToggle, vizDebugCtx]);

  const handleVisualizerDebugToggle = useCallback(() => {
    if (!visualizerDebugEnabled && profilerEnabled) {
      profilerToggle();
    }
    vizDebugCtx?.setIsDebugMode((prev) => !prev);
  }, [visualizerDebugEnabled, profilerEnabled, profilerToggle, vizDebugCtx]);

  return (
    <Container>
      <ControlBlock>
        <ControlRow>
          <div>
            <ControlLabelText htmlFor="settings-v2-qap-toggle">Quick Access Panel</ControlLabelText>
            <ControlHelp>Show the quick-access overlay on the idle screen.</ControlHelp>
          </div>
          <Switch
            id="settings-v2-qap-toggle"
            checked={qapEnabled}
            onCheckedChange={(checked) => setQapEnabled(checked)}
            aria-label="Toggle Quick Access Panel"
            variant="neutral"
          />
        </ControlRow>
      </ControlBlock>

      <Divider />

      <ControlBlock>
        <SectionGroupTitle>Library Cache</SectionGroupTitle>
        {clearState === 'confirming' ? (
          <>
            <CacheOptionList>
              {dataProviders.length === 0 && (
                <CacheOptionItem>
                  <CacheCheckbox
                    id="settings-v2-clear-likes"
                    type="checkbox"
                    checked={clearLikes}
                    onChange={(e) => setClearLikes(e.target.checked)}
                  />
                  <ControlHelp as="label" htmlFor="settings-v2-clear-likes">Also clear Likes</ControlHelp>
                </CacheOptionItem>
              )}
              <CacheOptionItem>
                <CacheCheckbox
                  id="settings-v2-clear-pins"
                  type="checkbox"
                  checked={clearPins}
                  onChange={(e) => setClearPins(e.target.checked)}
                />
                <ControlHelp as="label" htmlFor="settings-v2-clear-pins">Also clear Pins</ControlHelp>
              </CacheOptionItem>
              <CacheOptionItem>
                <CacheCheckbox
                  id="settings-v2-clear-accent-colors"
                  type="checkbox"
                  checked={clearAccentColors}
                  onChange={(e) => setClearAccentColors(e.target.checked)}
                />
                <ControlHelp as="label" htmlFor="settings-v2-clear-accent-colors">Also clear Accent Colors</ControlHelp>
              </CacheOptionItem>
            </CacheOptionList>
            <CacheButtons>
              <Button variant="outline" size="sm" onClick={handleClearCacheCancel}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleClearCacheConfirm}>
                Confirm Clear
              </Button>
            </CacheButtons>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={clearState === 'success' ? undefined : handleClearCacheClick}
            disabled={clearState === 'success'}
          >
            {clearState === 'success' ? 'Cleared!' : 'Clear Cache'}
          </Button>
        )}
      </ControlBlock>

      <Divider />

      <ControlBlock>
        <SectionGroupTitle>Diagnostics</SectionGroupTitle>
        <ControlRow>
          <div>
            <ControlLabelText htmlFor="settings-v2-profiler-toggle">Performance Profiler</ControlLabelText>
            <ControlHelp>Capture render and timing metrics for diagnostics.</ControlHelp>
          </div>
          <Switch
            id="settings-v2-profiler-toggle"
            checked={profilerEnabled}
            onCheckedChange={handleProfilerToggle}
            aria-label="Toggle Performance Profiler"
            variant="neutral"
          />
        </ControlRow>
        <ControlRow>
          <div>
            <ControlLabelText htmlFor="settings-v2-viz-debug-toggle">Visualizer Debug</ControlLabelText>
            <ControlHelp>Show on-screen overlays for visualizer tuning.</ControlHelp>
          </div>
          <Switch
            id="settings-v2-viz-debug-toggle"
            checked={visualizerDebugEnabled}
            onCheckedChange={handleVisualizerDebugToggle}
            aria-label="Toggle Visualizer Debug"
            variant="neutral"
          />
        </ControlRow>
      </ControlBlock>

      {dataProviders.length > 0 && (
        <>
          <Divider />
          <ControlBlock>
            <SectionGroupTitle>Provider Data</SectionGroupTitle>
            <Accordion type="single" collapsible>
              {dataProviders.map((p) => (
                <ProviderDataBlock key={p.id} providerName={p.name} catalog={p.catalog} />
              ))}
            </Accordion>
          </ControlBlock>
        </>
      )}

      <Divider />

      <ControlBlock>
        <SectionGroupTitle>About</SectionGroupTitle>
        <ControlHelp>Vorbis Player — keyboard-first music player.</ControlHelp>
        <ShortcutHintList>
          <ShortcutHintRow>
            <span>Show keyboard shortcuts</span>
            <Kbd>/</Kbd>
          </ShortcutHintRow>
          <ShortcutHintRow>
            <span>Open settings</span>
            <Kbd>Shift+S</Kbd>
          </ShortcutHintRow>
        </ShortcutHintList>
      </ControlBlock>
    </Container>
  );
};

AdvancedSection.displayName = 'SettingsV2.AdvancedSection';

export default AdvancedSection;
