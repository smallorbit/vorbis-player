import { useState, useEffect, useCallback } from 'react';
import { checkTrackSaved, saveTrack, unsaveTrack } from '@/services/spotify';

interface UseLikeTrackResult {
  isLiked: boolean;
  isLikePending: boolean;
  handleLikeToggle: () => void;
}

/**
 * Manages like/save state for a Spotify track.
 * 
 * Checks save status when trackId changes, and provides an optimistic
 * toggle handler that updates UI immediately before the API call completes.
 */
export function useLikeTrack(trackId: string | undefined): UseLikeTrackResult {
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkLikeStatus() {
      if (!trackId) {
        if (isMounted) setIsLiked(false);
        return;
      }

      try {
        if (isMounted) setIsLikePending(true);
        const liked = await checkTrackSaved(trackId);
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
  }, [trackId]);

  const handleLikeToggle = useCallback(async () => {
    if (!trackId || isLikePending) return;

    const newLikedState = !isLiked;
    setIsLikePending(true);
    setIsLiked(newLikedState);

    try {
      if (newLikedState) {
        await saveTrack(trackId);
      } else {
        await unsaveTrack(trackId);
      }
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      setIsLiked(isLiked);
    } finally {
      setIsLikePending(false);
    }
  }, [trackId, isLikePending, isLiked]);

  return { isLiked, isLikePending, handleLikeToggle };
}
