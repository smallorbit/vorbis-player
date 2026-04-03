import React, { memo, useState } from 'react';

import type { CatalogProvider } from '@/types/providers';
import { ART_REFRESHED_EVENT } from '@/hooks/useLibrarySync';

import {
  ControlGroup,
  ControlLabel,
  ResetButton,
} from './styled';
import { CollapsibleSection } from './CollapsibleSection';

export const ProviderDataSection = memo(({ providerName, catalog }: { providerName: string; catalog: CatalogProvider }) => {
  const [artStatus, setArtStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [likesStatus, setLikesStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const artBusy = artStatus === 'working';
  const likesBusy = likesStatus === 'working';

  const hasArtCache = !!catalog.clearArtCache;
  const hasRefreshArt = !!catalog.refreshArtCache;
  const hasLikesManagement = !!catalog.exportLikes && !!catalog.importLikes;
  const hasMetadataRefresh = !!catalog.refreshLikedMetadata;

  const handleClearArt = async () => {
    setArtStatus('working');
    await catalog.clearArtCache?.();
    setArtStatus('done');
    setTimeout(() => setArtStatus('idle'), 1500);
  };

  const handleRefreshArt = async () => {
    setArtStatus('working');
    await catalog.refreshArtCache?.();
    window.dispatchEvent(new CustomEvent(ART_REFRESHED_EVENT));
    setArtStatus('done');
    setTimeout(() => setArtStatus('idle'), 1500);
  };

  const handleExport = async () => {
    setLikesStatus('working');
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
    setLikesStatus('done');
    setTimeout(() => { setLikesStatus('idle'); setResultMessage(''); }, 1500);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLikesStatus('working');
    try {
      const json = await file.text();
      const count = await catalog.importLikes!(json);
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
      const result = await catalog.refreshLikedMetadata!();
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
    <CollapsibleSection title={`${providerName} Data`}>
      {hasArtCache && (
        <ControlGroup>
          <ControlLabel>Clear cached art so it re-downloads on next library load</ControlLabel>
          <ResetButton onClick={handleClearArt} disabled={artBusy}>
            {artStatus === 'done' ? 'Cleared!' : artBusy ? 'Working...' : 'Clear Art Cache'}
          </ResetButton>
        </ControlGroup>
      )}
      {hasRefreshArt && (
        <ControlGroup>
          <ControlLabel>Clear and immediately re-fetch fresh art in the background</ControlLabel>
          <ResetButton onClick={handleRefreshArt} disabled={artBusy}>
            {artStatus === 'done' ? 'Started!' : artBusy ? 'Working...' : 'Refresh Art'}
          </ResetButton>
        </ControlGroup>
      )}
      {hasLikesManagement && (
        <>
          <ControlGroup>
            <ControlLabel>Export liked songs to a JSON file for backup</ControlLabel>
            <ResetButton onClick={handleExport} disabled={likesBusy}>
              {likesStatus === 'done' && resultMessage === 'Exported!' ? 'Exported!' : likesBusy ? 'Working...' : 'Export Likes'}
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
              {likesStatus === 'done' && resultMessage.startsWith('Imported') ? resultMessage : likesBusy ? 'Working...' : 'Import Likes'}
            </ResetButton>
          </ControlGroup>
        </>
      )}
      {hasMetadataRefresh && (
        <ControlGroup>
          <ControlLabel>Re-scan {providerName} to update metadata for liked tracks</ControlLabel>
          <ResetButton onClick={handleRefreshMetadata} disabled={likesBusy}>
            {likesStatus === 'done' ? resultMessage || 'Done!' : likesBusy ? 'Scanning...' : 'Refresh Metadata'}
          </ResetButton>
        </ControlGroup>
      )}
    </CollapsibleSection>
  );
});
ProviderDataSection.displayName = 'ProviderDataSection';
