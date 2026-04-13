import type * as React from 'react';
import {
  ControlsContainer,
  SortControlsRow,
  RefreshButton,
} from './styled';
import { RefreshIcon } from './utils';

interface LibraryControlsProps {
  inDrawer: boolean;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

export function LibraryControls({
  inDrawer,
  onLibraryRefresh,
  isLibraryRefreshing,
}: LibraryControlsProps): React.JSX.Element {
  if (inDrawer) {
    return (
      <ControlsContainer $inDrawer>
        <SortControlsRow>
          {onLibraryRefresh && (
            <RefreshButton
              onClick={onLibraryRefresh}
              $spinning={!!isLibraryRefreshing}
              aria-label="Refresh library"
              title="Refresh library"
            >
              <RefreshIcon />
            </RefreshButton>
          )}
        </SortControlsRow>
      </ControlsContainer>
    );
  }

  return (
    <ControlsContainer>
      {onLibraryRefresh && (
        <RefreshButton
          onClick={onLibraryRefresh}
          $spinning={!!isLibraryRefreshing}
          aria-label="Refresh library"
          title="Refresh library"
        >
          <RefreshIcon />
        </RefreshButton>
      )}
    </ControlsContainer>
  );
}
