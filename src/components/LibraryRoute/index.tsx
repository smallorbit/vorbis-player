import React from 'react';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import type { ProviderId, AddToQueueResult, MediaTrack } from '@/types/domain';
import { LibraryRouteRoot, MobileLayout, DesktopLayout } from './styled';

// LibraryRoute assumes upstream guards have already filtered out cold-start cases:
// - AudioPlayer.tsx routes to ProviderSetupScreen when needsSetup === true
// - PlayerStateRenderer.tsx routes to WelcomeScreen when !welcomeSeen
// If this component renders, at least one provider is connected AND welcome has been dismissed.

export interface LibraryRouteProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (id: string, name?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onOpenSettings: () => void;
  onResume?: () => void;
  hasResumableSession: boolean;
}

const LibraryRoute: React.FC<LibraryRouteProps> = () => {
  const { isMobile } = usePlayerSizingContext();
  return (
    <LibraryRouteRoot>
      {isMobile ? (
        <MobileLayout data-testid="library-route-mobile">
          <div>New Library Route — mobile shell (placeholder)</div>
        </MobileLayout>
      ) : (
        <DesktopLayout data-testid="library-route-desktop">
          <div>New Library Route — desktop shell (placeholder)</div>
        </DesktopLayout>
      )}
    </LibraryRouteRoot>
  );
};

LibraryRoute.displayName = 'LibraryRoute';
export default LibraryRoute;
