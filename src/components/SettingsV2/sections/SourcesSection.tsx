import React from 'react';
import styled from 'styled-components';

import { MusicSourcesSection, NativeQueueSyncSection } from '@/components/AppSettingsMenu/SourcesSections';

/**
 * SettingsV2 Sources section — phase 2 port (#1450).
 *
 * Reuses the legacy `MusicSourcesSection` + `NativeQueueSyncSection` directly
 * so v2 reads the same hooks (`useProviderContext`, `useTrackListContext`) and
 * writes the same `STORAGE_KEYS.SPOTIFY_QUEUE_SYNC` /
 * `STORAGE_KEYS.SPOTIFY_QUEUE_CROSS_PROVIDER` keys. Both legacy components
 * self-gate (Music Sources requires ≥2 providers; Native Queue Sync requires
 * `capabilities.hasNativeQueueSync` on a connected provider) and return
 * `null` when their conditions aren't met — the v2 section then renders
 * empty, matching v1 behaviour.
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

export default SourcesSection;
