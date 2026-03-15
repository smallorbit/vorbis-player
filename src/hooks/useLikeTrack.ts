import { useState, useEffect, useCallback } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { ProviderId } from '@/types/domain';

interface UseLikeTrackResult {
  isLiked: boolean;
  isLikePending: boolean;
  handleLikeToggle: () => void;
  /** Whether the resolved provider supports save/like. */
  canSaveTrack: boolean;
}

/**
 * Manages like/save state for a track via its owning provider's catalog.
 *
 * When `trackProvider` is supplied, the hook uses that provider's catalog
 * instead of the active provider. This is essential for cross-provider
 * playlists (e.g. unified liked songs) where the playing track may belong
 * to a different provider than the currently active one.
 */
export function useLikeTrack(trackId: string | undefined, trackProvider?: ProviderId): UseLikeTrackResult {
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  const { activeDescriptor, getDescriptor } = useProviderContext();
  const resolvedDescriptor = trackProvider ? getDescriptor(trackProvider) : activeDescriptor;
  const catalog = resolvedDescriptor?.catalog;
  const canSaveTrack = resolvedDescriptor?.capabilities.hasSaveTrack ?? false;

  useEffect(() => {
    let isMounted = true;

    async function checkLikeStatus() {
      if (!trackId || !catalog?.isTrackSaved) {
        if (isMounted) setIsLiked(false);
        return;
      }

      try {
        if (isMounted) setIsLikePending(true);
        const liked = await catalog.isTrackSaved(trackId);
        if (isMounted) setIsLiked(liked);
      } catch (error) {
        console.error('Failed to check like status:', error);
        if (isMounted) setIsLiked(false);
      } finally {
        if (isMounted) setIsLikePending(false);
      }
    }

    checkLikeStatus();

    return () => {
      isMounted = false;
    };
  }, [trackId, catalog]);

  const handleLikeToggle = useCallback(async () => {
    if (!trackId || isLikePending || !catalog?.setTrackSaved) return;

    const newLikedState = !isLiked;
    setIsLikePending(true);
    setIsLiked(newLikedState);

    try {
      await catalog.setTrackSaved(trackId, newLikedState);
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      setIsLiked(isLiked);
    } finally {
      setIsLikePending(false);
    }
  }, [trackId, isLikePending, isLiked, catalog]);

  return { isLiked, isLikePending, handleLikeToggle, canSaveTrack };
}
