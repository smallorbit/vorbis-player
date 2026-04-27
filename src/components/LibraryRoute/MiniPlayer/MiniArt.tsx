import React from 'react';
import { ArtFrame, ArtImage, PulseDot } from './MiniPlayer.styled';

export interface MiniArtProps {
  imageUrl?: string;
  alt: string;
  isPlaying: boolean;
}

const MiniArt: React.FC<MiniArtProps> = ({ imageUrl, alt, isPlaying }) => (
  <ArtFrame>
    {imageUrl ? <ArtImage src={imageUrl} alt={alt} loading="lazy" /> : null}
    <PulseDot
      data-testid="mini-pulse-dot"
      data-playing={isPlaying ? 'true' : 'false'}
      $playing={isPlaying}
      aria-hidden="true"
    />
  </ArtFrame>
);

MiniArt.displayName = 'MiniArt';
export default MiniArt;
