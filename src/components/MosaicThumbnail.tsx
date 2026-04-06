import { useState, useEffect } from 'react';
import * as React from 'react';
import styled from 'styled-components';
import { getAlbumArt } from '@/providers/dropbox/dropboxArtCache';

const MosaicGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

interface MosaicThumbnailProps {
  /** Album folder paths to resolve from IndexedDB art cache. */
  albumPaths: string[];
  alt: string;
}

export const MosaicThumbnail: React.FC<MosaicThumbnailProps> = React.memo(
  function MosaicThumbnail({ albumPaths, alt }) {
    const [resolvedUrls, setResolvedUrls] = useState<string[]>([]);

    useEffect(() => {
      let cancelled = false;
      Promise.all(albumPaths.map(path => getAlbumArt(path))).then(results => {
        if (cancelled) return;
        const urls = results.filter((url): url is string => url != null);
        setResolvedUrls(urls);
      });
      return () => { cancelled = true; };
    }, [albumPaths]);

    if (resolvedUrls.length === 0) return null;

    if (resolvedUrls.length === 1) {
      return <img src={resolvedUrls[0]} alt={alt} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />;
    }

    const [a, b] = resolvedUrls;
    const quadrants = resolvedUrls.length >= 4
      ? [resolvedUrls[0], resolvedUrls[1], resolvedUrls[2], resolvedUrls[3]]
      : [a, b, b, a];

    return (
      <MosaicGrid>
        {quadrants.map((url, i) => (
          <img key={i} src={url} alt={`${alt} cover ${i + 1}`} loading="lazy" decoding="async" />
        ))}
      </MosaicGrid>
    );
  },
);
