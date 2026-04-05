import React, { Suspense, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { MediaTrack } from '@/types/domain';
import { DrawerFallback, DrawerFallbackCard } from './styled';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import {
  QueueDrawerContainer,
  QueueContent,
  QueueOverlay,
  QueueHeader,
  QueueTitle,
  CloseButton,
  SaveButton,
  HeaderActions,
} from './QueueDrawer.styled';

const QueueTrackList = React.lazy(() => import('./QueueTrackList'));

/** Detect reorder / id changes when length and current index are unchanged (memo guard). */
function queueTrackOrderKey(tracks: { id: string }[]): string {
  return tracks.map((t) => t.id).join('|');
}

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: MediaTrack[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  onRemoveTrack?: (index: number) => void;
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  showProviderIcons?: boolean;
  radioActive?: boolean;
  radioSeedDescription?: string | null;
  onSaveQueue?: () => void;
  canSaveQueue?: boolean;
}

// Custom comparison function for QueueDrawer memo optimization
const areQueueDrawerPropsEqual = (
  prevProps: QueueDrawerProps,
  nextProps: QueueDrawerProps
): boolean => {
  // Check if open state changed
  if (prevProps.isOpen !== nextProps.isOpen) {
    return false;
  }

  // Check if current track changed
  if (prevProps.currentTrackIndex !== nextProps.currentTrackIndex) {
    return false;
  }

  if (prevProps.tracks.length !== nextProps.tracks.length) {
    return false;
  }

  if (queueTrackOrderKey(prevProps.tracks) !== queueTrackOrderKey(nextProps.tracks)) {
    return false;
  }

  if (prevProps.radioActive !== nextProps.radioActive) {
    return false;
  }

  if (prevProps.radioSeedDescription !== nextProps.radioSeedDescription) {
    return false;
  }

  if (prevProps.canSaveQueue !== nextProps.canSaveQueue) {
    return false;
  }

  // Callback props (onClose, onTrackSelect, onRemoveTrack, onReorderTracks, onSaveQueue,
  // showProviderIcons) are intentionally omitted — they are expected to be stable
  // useCallback references from the parent. If an unstable callback is ever passed,
  // this comparator will suppress the re-render incorrectly.
  return true;
};

const QueueDrawer = memo<QueueDrawerProps>(({
  isOpen,
  onClose,
  tracks,
  currentTrackIndex,
  onTrackSelect,
  onRemoveTrack,
  onReorderTracks,
  showProviderIcons,
  radioActive,
  radioSeedDescription,
  onSaveQueue,
  canSaveQueue,
}) => {
  // Get responsive sizing information
  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizingContext();

  // Calculate responsive width for the drawer
  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, 320);
    if (isTablet) return Math.min(viewport.width * 0.4, 480);
    return Math.min(viewport.width * 0.3, 600);
  }, [viewport.width, isMobile, isTablet]);
  return createPortal(
    <>
      <QueueOverlay
        isOpen={isOpen}
        onClick={onClose}
      />

      <QueueDrawerContainer
        isOpen={isOpen}
        width={drawerWidth}
        transitionDuration={transitionDuration}
        transitionEasing={transitionEasing}
      >
        <QueueHeader>
          <div>
            <QueueTitle>{radioActive ? 'Radio' : 'Queue'}</QueueTitle>
            {radioActive && radioSeedDescription && (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                {radioSeedDescription}
              </div>
            )}
          </div>
          <HeaderActions>
            {canSaveQueue && (
              <SaveButton onClick={onSaveQueue} title="Save queue as playlist" aria-label="Save queue as playlist">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              </SaveButton>
            )}
            <CloseButton onClick={onClose} aria-label="Close queue drawer">×</CloseButton>
          </HeaderActions>
        </QueueHeader>

        <QueueContent>
          <Suspense fallback={
            <DrawerFallback>
              <DrawerFallbackCard>
                <div style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textAlign: 'center'
                }}>
                  Loading queue...
                </div>
              </DrawerFallbackCard>
            </DrawerFallback>
          }>
            <QueueTrackList
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              onTrackSelect={(index) => {
                onTrackSelect(index);
                onClose();
              }}
              onRemoveTrack={onRemoveTrack}
              onReorderTracks={onReorderTracks}
              isOpen={isOpen}
              showProviderIcons={showProviderIcons}
              canEdit
            />
          </Suspense>
        </QueueContent>
      </QueueDrawerContainer>
    </>,
    document.body
  );
}, areQueueDrawerPropsEqual);

QueueDrawer.displayName = 'QueueDrawer';

export default QueueDrawer;