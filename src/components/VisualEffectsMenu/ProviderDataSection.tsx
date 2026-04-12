import React, { memo, useState, useCallback } from 'react';

import type { CatalogProvider } from '@/types/providers';
import { ART_REFRESHED_EVENT } from '@/hooks/useLibrarySync';
import { useAsyncAction, FEEDBACK_DISPLAY_MS } from '@/hooks/useAsyncAction';

import {
  ControlGroup,
  ControlLabel,
  ResetButton,
} from './styled';
import { CollapsibleSection } from './CollapsibleSection';

export const ProviderDataSection = memo(({ providerName, catalog }: { providerName: string; catalog: CatalogProvider }) => {
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    setTimeout(() => { setImportStatus('idle'); setResultMessage(''); }, FEEDBACK_DISPLAY_MS);
  }, [catalog]);

  const artBusy = clearArtStatus === 'working' || refreshArtStatus === 'working';
  const likesBusy = exportStatus === 'working' || importStatus === 'working' || metadataStatus === 'working';

  return (
    <CollapsibleSection title={`${providerName} Data`}>
      {hasArtCache && (
        <ControlGroup>
          <ControlLabel>Clear cached art so it re-downloads on next library load</ControlLabel>
          <ResetButton onClick={runClearArt} disabled={artBusy}>
            {clearArtStatus === 'done' ? 'Cleared!' : artBusy ? 'Working...' : 'Clear Art Cache'}
          </ResetButton>
        </ControlGroup>
      )}
      {hasRefreshArt && (
        <ControlGroup>
          <ControlLabel>Clear and immediately re-fetch fresh art in the background</ControlLabel>
          <ResetButton onClick={runRefreshArt} disabled={artBusy}>
            {refreshArtStatus === 'done' ? 'Started!' : artBusy ? 'Working...' : 'Refresh Art'}
          </ResetButton>
        </ControlGroup>
      )}
      {hasLikesManagement && (
        <>
          <ControlGroup>
            <ControlLabel>Export liked songs to a JSON file for backup</ControlLabel>
            <ResetButton onClick={runExport} disabled={likesBusy}>
              {exportStatus === 'done' && resultMessage === 'Exported!' ? 'Exported!' : likesBusy ? 'Working...' : 'Export Likes'}
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
            <ResetButton onClick={() => fileInputRef.current?.click()} disabled={likesBusy}>
              {importStatus === 'done' && resultMessage.startsWith('Imported') ? resultMessage : likesBusy ? 'Working...' : 'Import Likes'}
            </ResetButton>
          </ControlGroup>
        </>
      )}
      {hasMetadataRefresh && (
        <ControlGroup>
          <ControlLabel>Re-scan {providerName} to update metadata for liked tracks</ControlLabel>
          <ResetButton onClick={runRefreshMetadata} disabled={likesBusy}>
            {metadataStatus === 'done' ? resultMessage || 'Done!' : likesBusy ? 'Scanning...' : 'Refresh Metadata'}
          </ResetButton>
        </ControlGroup>
      )}
    </CollapsibleSection>
  );
});
ProviderDataSection.displayName = 'ProviderDataSection';
