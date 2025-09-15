/**
 * @fileoverview LocalLibraryDrawer Component
 * 
 * A modal drawer component for browsing and managing local music library.
 * Integrates with the unified player system to provide seamless local/Spotify
 * music playback experience.
 * 
 * @dependencies
 * - LocalLibraryBrowser: Core library browsing interface
 * - localLibraryDatabaseIPC: Database operations for local music
 * - usePlayerState: Global player state management
 * 
 * @features
 * - Responsive drawer with touch/swipe support
 * - Keyboard navigation and accessibility
 * - Library statistics display
 * - Track selection and queue management
 * 
 * @state
 * - isOpen: Controls drawer visibility
 * - stats: Library statistics (tracks, albums, artists, duration)
 * - touchStart/touchEnd: Mobile swipe gesture handling
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

import React, { Suspense, memo, useEffect, useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import type { LocalTrack } from '../types/spotify.d.ts';
import { theme } from '../styles/theme';
import LocalLibraryBrowser from './LocalLibraryBrowser';
import { localLibraryDatabase } from '../services/localLibraryDatabaseIPC';

const DrawerOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: ${theme.zIndex.overlay};
  -webkit-app-region: no-drag;
`;

const DrawerContainer = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80vh;
  max-height: 800px;
  min-height: 400px;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border-top: 1px solid ${theme.colors.popover.border};
  border-top-left-radius: ${theme.borderRadius.xl};
  border-top-right-radius: ${theme.borderRadius.xl};
  transform: translateY(${props => props.$isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: ${theme.zIndex.modal};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  
  @media (max-width: ${theme.breakpoints.md}) {
    height: 90vh;
    border-radius: 0;
    max-height: none;
  }
  
  @media (min-width: ${theme.breakpoints.lg}) {
    width: 90%;
    max-width: 1200px;
    left: 50%;
    transform: translateX(-50%) translateY(${props => props.$isOpen ? '0' : '100%'});
  }
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
`;

const DrawerTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LibraryIcon = styled.span`
  font-size: 1.5rem;
`;

const LibraryStats = styled.div`
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  
  @media (max-width: ${theme.breakpoints.sm}) {
    display: none;
  }
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  span:first-child {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
  
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const DrawerContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const DragHandle = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  width: 3rem;
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  cursor: grab;
  
  &:active {
    cursor: grabbing;
  }
  
  @media (min-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const LoadingFallback = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
`;

/**
 * LocalLibraryDrawer - Modal drawer for local music library management
 * 
 * This component provides a full-screen modal interface for browsing and
 * managing the local music library. It integrates with the unified player
 * system to provide seamless switching between local and Spotify music sources.
 * 
 * @component
 * @example
 * ```tsx
 * <LocalLibraryDrawer
 *   isOpen={showLibrary}
 *   onClose={() => setShowLibrary(false)}
 *   onTrackSelect={handleTrackSelect}
 *   currentTrackId={currentTrack?.id}
 *   accentColor={accentColor}
 * />
 * ```
 * 
 * @props {boolean} isOpen - Controls drawer visibility
 * @props {() => void} onClose - Callback when drawer should close
 * @props {(track: LocalTrack) => void} onTrackSelect - Track selection handler
 * @props {(tracks: LocalTrack[], startIndex?: number) => void} onQueueTracks - Queue management handler
 * @props {string} currentTrackId - Currently playing track ID for highlighting
 * @props {string} accentColor - Theme accent color for visual consistency
 * 
 * @state
 * - stats: Library statistics loaded from database
 * - touchStart/touchEnd: Mobile swipe gesture coordinates
 * - lastFocusedElement: Accessibility focus management
 * 
 * @dependencies
 * - LocalLibraryBrowser: Core browsing interface
 * - localLibraryDatabaseIPC: Database operations
 * - theme: Design system tokens
 */
interface LocalLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackSelect?: (track: LocalTrack) => void;
  onQueueTracks?: (tracks: LocalTrack[], startIndex?: number) => void;
  currentTrackId?: string | null;
  accentColor?: string;
}

/**
 * Formats total duration in milliseconds to human-readable format
 * 
 * Converts milliseconds to hours and minutes display format.
 * Shows hours only when duration exceeds 1 hour for cleaner display.
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m" or "45m")
 * 
 * @example
 * formatTotalDuration(9000000) // "2h 30m"
 * formatTotalDuration(2700000) // "45m"
 */
const formatTotalDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Custom equality check for memo optimization
 * 
 * Compares only the props that affect component rendering to prevent
 * unnecessary re-renders when other props change.
 * 
 * @param prevProps - Previous component props
 * @param nextProps - Next component props
 * @returns True if props are equal for rendering purposes
 */
const arePropsEqual = (
  prevProps: LocalLibraryDrawerProps,
  nextProps: LocalLibraryDrawerProps
): boolean => {
  if (prevProps.isOpen !== nextProps.isOpen) {
    return false;
  }

  if (prevProps.currentTrackId !== nextProps.currentTrackId) {
    return false;
  }

  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }

  return true;
};

export const LocalLibraryDrawer = memo<LocalLibraryDrawerProps>(({
  isOpen,
  onClose,
  onTrackSelect,
  onQueueTracks,
  currentTrackId,
  accentColor = '#1db954'
}) => {
  const [stats, setStats] = useState({
    totalTracks: 0,
    totalAlbums: 0,
    totalArtists: 0,
    totalDuration: 0
  });

  // Focus management
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  // Load library stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsData = await localLibraryDatabase.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load library stats:', error);
      }
    };

    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  // Enhanced keyboard navigation and focus management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Tab': {
          // Focus trapping within the drawer
          const focusableElements = drawerRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as NodeListOf<HTMLElement>;

          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
              event.preventDefault();
              lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
              event.preventDefault();
              firstElement.focus();
            }
          }
          break;
        }
      }
    };

    if (isOpen) {
      // Store the currently focused element
      lastFocusedElement.current = document.activeElement as HTMLElement;

      document.addEventListener('keydown', handleKeyDown);

      // Focus the close button when drawer opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else {
      // Restore focus to the previously focused element
      if (lastFocusedElement.current) {
        lastFocusedElement.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle swipe down to close on mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isSwipeDown = distance < -50;

    if (isSwipeDown) {
      onClose();
    }
  }, [touchStart, touchEnd, onClose]);

  return (
    <>
      <DrawerOverlay
        $isOpen={isOpen}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <DrawerContainer
        ref={drawerRef}
        $isOpen={isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-library-title"
        aria-describedby="local-library-description"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <DragHandle />

        <DrawerHeader>
          <DrawerTitle id="local-library-title">
            <LibraryIcon>📚</LibraryIcon>
            Local Music Library
          </DrawerTitle>

          <LibraryStats>
            <StatItem>
              <span>{stats.totalTracks}</span>
              <span>tracks</span>
            </StatItem>
            <StatItem>
              <span>{stats.totalAlbums}</span>
              <span>albums</span>
            </StatItem>
            <StatItem>
              <span>{stats.totalArtists}</span>
              <span>artists</span>
            </StatItem>
            <StatItem>
              <span>{formatTotalDuration(stats.totalDuration)}</span>
            </StatItem>
          </LibraryStats>

          <CloseButton
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close library drawer"
            title="Close (ESC)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </CloseButton>
        </DrawerHeader>

        {/* Hidden description for screen readers */}
        <div id="local-library-description" style={{ display: 'none' }}>
          Browse your local music collection. Use arrow keys to navigate, Enter to select tracks, and Escape to close.
        </div>

        <DrawerContent>
          <Suspense fallback={
            <LoadingFallback>
              Loading library...
            </LoadingFallback>
          }>
            <LocalLibraryBrowser
              onTrackSelect={onTrackSelect}
              onQueueTracks={onQueueTracks}
              isDrawerMode={true}
              currentTrackId={currentTrackId}
              accentColor={accentColor}
            />
          </Suspense>
        </DrawerContent>
      </DrawerContainer>
    </>
  );
}, arePropsEqual);

LocalLibraryDrawer.displayName = 'LocalLibraryDrawer';

export default LocalLibraryDrawer;