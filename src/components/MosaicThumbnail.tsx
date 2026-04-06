import * as React from 'react';
import styled from 'styled-components';

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
  coverUrls: string[];
  alt: string;
}

export const MosaicThumbnail: React.FC<MosaicThumbnailProps> = React.memo(
  function MosaicThumbnail({ coverUrls, alt }) {
    if (coverUrls.length === 0) return null;

    if (coverUrls.length === 1) {
      return <img src={coverUrls[0]} alt={alt} loading="lazy" decoding="async" />;
    }

    const [a, b] = coverUrls;
    const quadrants = coverUrls.length >= 4
      ? [coverUrls[0], coverUrls[1], coverUrls[2], coverUrls[3]]
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
