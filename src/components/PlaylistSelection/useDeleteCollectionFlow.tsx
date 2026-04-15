import { useState, useCallback } from 'react';
import * as React from 'react';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { isSavedPlaylistId, extractPlaylistPath } from '@/constants/playlist';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';

type DeleteTarget = { id: string; name: string; provider?: ProviderId };

export interface UseDeleteCollectionFlowReturn {
  openDelete: (id: string, name: string, provider: ProviderId | undefined) => void;
  confirmDeletePortal: React.ReactNode;
}

export function useDeleteCollectionFlow(
  getDescriptor: (id: ProviderId) => ProviderDescriptor | undefined,
  activeDescriptor: ProviderDescriptor | null,
  removeCollection: (id: string) => void,
): UseDeleteCollectionFlowReturn {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const openDelete = useCallback((id: string, name: string, provider: ProviderId | undefined) => {
    setDeleteTarget({ id, name, provider });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const provider = deleteTarget.provider ?? activeDescriptor?.id;
    const descriptor = provider ? getDescriptor(provider) : activeDescriptor;
    if (!descriptor?.catalog.deleteCollection) return;

    const collectionId = isSavedPlaylistId(deleteTarget.id)
      ? extractPlaylistPath(deleteTarget.id)
      : deleteTarget.id;

    await descriptor.catalog.deleteCollection(collectionId, 'playlist');
    removeCollection(deleteTarget.id);
    setDeleteTarget(null);
    window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT, { detail: { providerId: provider } }));
  }, [deleteTarget, activeDescriptor, getDescriptor, removeCollection]);

  const handleDeleteClose = useCallback(() => setDeleteTarget(null), []);

  const confirmDeletePortal = deleteTarget ? React.createElement(ConfirmDeleteDialog, {
    name: deleteTarget.name,
    onConfirm: handleDeleteConfirm,
    onClose: handleDeleteClose,
  }) : null;

  return { openDelete, confirmDeletePortal };
}
