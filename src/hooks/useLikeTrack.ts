import { useState, useEffect, useCallback } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';

interface UseLikeTrackResult {
  isLiked: boolean;
  isLikePending: boolean;
  handleLikeToggle: () => void;
  /** Whether the active provider supports save/like. */
  canSaveTrack: boolean;
}

/**
 * Manages like/save state for a track via the active provider's catalog.
 *
 * If the active provider doesn't support save/like (e.g. Dropbox),
 * canSaveTrack is false and the hook is a no-op.
 */
export function useLikeTrack(trackId: string | undefined): UseLikeTrackResult {
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  const { activeDescriptor } = useProviderContext();
  const catalog = activeDescriptor?.catalog;
  const canSaveTrack = activeDescriptor?.capabilities.hasSaveTrack ?? false;

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
