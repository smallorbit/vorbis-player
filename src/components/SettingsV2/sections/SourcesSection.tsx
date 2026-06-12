import React from 'react';
import styled from 'styled-components';

import { MusicSourcesSection, NativeQueueSyncSection } from './MusicSourcesSection';

/**
 * SettingsV2 Sources section.
 *
 * Composes `MusicSourcesSection` + `NativeQueueSyncSection`, which read from
 * `useProviderContext` / `useTrackListContext` and write the same
 * `STORAGE_KEYS.SPOTIFY_QUEUE_SYNC` / `STORAGE_KEYS.SPOTIFY_QUEUE_CROSS_PROVIDER`
 * keys. Both components self-gate (Music Sources requires ≥2 providers; Native
 * Queue Sync requires `capabilities.hasNativeQueueSync` on a connected
 * provider) and return `null` when their conditions aren't met — the section
 * then renders empty.
 */

const SourcesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const SourcesSection: React.FC = () => {
  return (
    <SourcesContainer>
      <MusicSourcesSection />
      <NativeQueueSyncSection />
    </SourcesContainer>
  );
};

SourcesSection.displayName = 'SettingsV2.SourcesSection';
