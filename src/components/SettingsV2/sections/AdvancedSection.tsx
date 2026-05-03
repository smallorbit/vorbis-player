import React, { useCallback, useMemo, useState } from 'react';

import { useProviderContext } from '@/contexts/ProviderContext';
import { useProfilingContext } from '@/contexts/ProfilingContext';
import { useVisualizerDebug } from '@/contexts/VisualizerDebugContext';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { clearCacheWithOptions } from '@/services/cache/libraryCache';
import { clearAllPins } from '@/services/settings/pinnedItemsStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { STATUS_RESET_DELAY_MS } from '@/constants/statusTiming';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';

import { ProviderDataBlock } from './ProviderDataBlock';
import {
  Container,
  ControlBlock,
  ControlRow,
  ControlLabelText,
  ControlHelp,
  SectionGroupTitle,
  Divider,
  CacheOptionList,
  CacheOptionItem,
  CacheCheckbox,
  CacheButtons,
  ShortcutHintList,
  ShortcutHintRow,
  Kbd,
} from './AdvancedSection.styled';

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
        {/* TODO(#1462): surface app version once a build-time constant is wired */}
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
