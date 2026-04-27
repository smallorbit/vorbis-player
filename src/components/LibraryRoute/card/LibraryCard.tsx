import React, { useCallback } from 'react';
import type { ContextMenuRequest, LibraryItemKind } from '../types';
import type { ProviderId } from '@/types/domain';
import { useLongPress } from './useLongPress';
import ProviderIcon from '@/components/ProviderIcon';
import {
  CardButton,
  ArtWrap,
  ArtImage,
  ArtPlaceholder,
  ProviderBadge,
  Title,
  Subtitle,
} from './LibraryCard.styled';

export interface LibraryCardProps {
  kind: LibraryItemKind;
  id: string;
  provider?: ProviderId;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  showProviderBadge?: boolean;
  variant: 'row' | 'grid';
  onSelect: () => void;
  onContextMenuRequest?: (req: ContextMenuRequest) => void;
}

const placeholderGlyphForKind = (kind: LibraryItemKind): string => {
  switch (kind) {
    case 'album':
      return '💿';
    case 'liked':
      return '♥';
    case 'recently-played':
      return '⏱';
    default:
      return '♪';
  }
};

const LibraryCard: React.FC<LibraryCardProps> = ({
  kind,
  id,
  provider,
  name,
  subtitle,
  imageUrl,
  showProviderBadge,
  variant,
  onSelect,
  onContextMenuRequest,
}) => {
  const longPressEnabled = !!onContextMenuRequest;

  const fireContextMenu = useCallback(
    (anchorRect: DOMRect) => {
      onContextMenuRequest?.({ kind, id, provider, name, anchorRect });
    },
    [onContextMenuRequest, kind, id, provider, name],
  );

  const longPressHandlers = useLongPress({
    onLongPress: fireContextMenu,
    onTap: longPressEnabled ? onSelect : undefined,
    enabled: longPressEnabled,
  });

  const handleClick = useCallback(() => {
    if (longPressEnabled) return;
    onSelect();
  }, [longPressEnabled, onSelect]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!onContextMenuRequest) return;
      e.preventDefault();
      const anchor = new DOMRect(e.clientX, e.clientY, 0, 0);
      fireContextMenu(anchor);
    },
    [onContextMenuRequest, fireContextMenu],
  );

  return (
    <CardButton
      type="button"
      $variant={variant}
      data-testid={`library-card-${kind}-${id}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...longPressHandlers}
      aria-label={subtitle ? `${name}, ${subtitle}` : name}
    >
      <ArtWrap>
        {imageUrl ? (
          <ArtImage src={imageUrl} alt="" loading="lazy" />
        ) : (
          <ArtPlaceholder>{placeholderGlyphForKind(kind)}</ArtPlaceholder>
        )}
        {showProviderBadge && provider && (
          <ProviderBadge>
            <ProviderIcon provider={provider} size={20} />
          </ProviderBadge>
        )}
      </ArtWrap>
      <Title>{name}</Title>
      {subtitle && <Subtitle>{subtitle}</Subtitle>}
    </CardButton>
  );
};

LibraryCard.displayName = 'LibraryCard';
export default LibraryCard;
