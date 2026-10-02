import type { ReactNode } from 'react';
import {
  QueueListRoot,
  QueueListCard,
  QueueListCardHeader,
  QueueListCardHeaderRow,
  QueueListMeta,
  QueueListContent,
  QueueListScroll,
  QueueListItems,
} from './QueueTrackList.styled';

interface QueueListChromeProps {
  trackCount: number;
  editButton?: ReactNode | undefined;
  children: ReactNode;
  metaOnly?: boolean | undefined;
}

/** Shared list card chrome (track count header + scroll region). */
export function QueueListChrome({
  trackCount,
  editButton,
  children,
  metaOnly = false,
}: QueueListChromeProps) {
  return (
    <QueueListRoot>
      <QueueListCard>
        <QueueListCardHeader>
          {metaOnly ? (
            <QueueListMeta>{trackCount} tracks</QueueListMeta>
          ) : (
            <QueueListCardHeaderRow>
              <QueueListMeta>{trackCount} tracks</QueueListMeta>
              {editButton}
            </QueueListCardHeaderRow>
          )}
        </QueueListCardHeader>
        <QueueListContent>
          <QueueListScroll>
            <QueueListItems>{children}</QueueListItems>
          </QueueListScroll>
        </QueueListContent>
      </QueueListCard>
    </QueueListRoot>
  );
}
