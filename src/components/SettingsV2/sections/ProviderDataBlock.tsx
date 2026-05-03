import React, { useCallback, useRef, useState } from 'react';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ART_REFRESHED_EVENT } from '@/hooks/useLibrarySync';
import { STATUS_RESET_DELAY_MS } from '@/constants/statusTiming';
import type { CatalogProvider } from '@/types/providers';

import { Button } from '@/components/ui/button';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

import { ControlBlock, ControlRow, ControlHelp } from './AdvancedSection.styled';

interface ProviderDataBlockProps {
  providerName: string;
  catalog: CatalogProvider;
}

export const ProviderDataBlock: React.FC<ProviderDataBlockProps> = ({ providerName, catalog }) => {
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
