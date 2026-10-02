import { Suspense, lazy } from 'react';
import {
  PlaybackActionsProvider,
  type PlaybackActionsValue,
} from '@/contexts/PlaybackActionsContext';
import type { LibraryRouteSharedProps } from '@/contexts/libraryRouteHost';

export type { LibraryRouteSharedProps };

const LibraryRouteLazy = lazy(() => import('@/components/LibraryRoute'));

interface LibraryRouteMountProps {
  playbackActions: PlaybackActionsValue;
  routeProps: LibraryRouteSharedProps;
}

/** Single Suspense + provider wrapper for both LibraryRoute mounts in AudioPlayer (F25). */
export function LibraryRouteMount({ playbackActions, routeProps }: LibraryRouteMountProps) {
  return (
    <Suspense fallback={null}>
      <PlaybackActionsProvider value={playbackActions}>
        <LibraryRouteLazy {...routeProps} />
      </PlaybackActionsProvider>
    </Suspense>
  );
}
