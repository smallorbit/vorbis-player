import { useState, useEffect } from 'react';
import * as React from 'react';
import styled from 'styled-components';
import type { ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { IMAGE_LOAD_TIMEOUT_MS } from '@/constants/timing';

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

const Placeholder = styled.div`
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
`;

interface MosaicThumbnailProps {
  /** Provider whose catalog resolves the album paths to artwork. */
  provider: ProviderId;
  albumPaths: string[];
  alt: string;
}

export const MosaicThumbnail: React.FC<MosaicThumbnailProps> = React.memo(
  function MosaicThumbnail({ provider, albumPaths, alt }) {
    const [resolved, setResolved] = useState<(string | null)[]>([]);

    useEffect(() => {
      let cancelled = false;
      const resolveArtwork = providerRegistry.get(provider)?.catalog.resolveArtwork;
      const resolve = () =>
        Promise.all(
          albumPaths.map(path => resolveArtwork?.(path) ?? Promise.resolve(null)),
        ).then(results => {
          if (!cancelled) setResolved(results);
          return results;
        });

      resolve().then(results => {
        if (cancelled) return;
        const hasMissing = results.some(url => url == null);
        if (hasMissing) {
          setTimeout(() => { if (!cancelled) resolve(); }, IMAGE_LOAD_TIMEOUT_MS);
        }
      });
      return () => { cancelled = true; };
    }, [provider, albumPaths]);

    const hasAny = resolved.some(url => url != null);
    if (!hasAny) return null;

    // Single album with art → full-bleed
    if (albumPaths.length === 1 && resolved[0]) {
      return <img src={resolved[0]} alt={alt} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />;
    }

    // Build the 4 quadrants
    let quadrants: (string | null)[];
    if (resolved.length >= 4) {
      quadrants = [resolved[0] ?? null, resolved[1] ?? null, resolved[2] ?? null, resolved[3] ?? null];
    } else {
      // 2-3 paths → diagonal duplication: A in Q1+Q4, B in Q2+Q3
      const a = resolved[0] ?? null;
      const b = resolved[1] ?? resolved[0] ?? null;
      quadrants = [a, b, b, a];
    }

    return (
      <MosaicGrid>
        {quadrants.map((url, i) =>
          url
            ? <img key={i} src={url} alt={`${alt} cover ${i + 1}`} loading="lazy" decoding="async" />
            : <Placeholder key={i}>♪</Placeholder>
        )}
      </MosaicGrid>
    );
  },
);
