import React from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';

interface AlbumArtProps {
  currentTrack: Track | null;
  objectPosition?: string;
  accentColor?: string;
}
// const objectPosition = 'center center calc(50% + 3.5rem)';
const AlbumArtContainer = styled.div<{ accentColor?: string }>`
  
  border-radius: 1.25rem;
  position: relative;
  overflow: hidden;
  background: transparent;
  margin: 1.25rem;
  backdrop-filter: blur(10px);
  z-index: 2;
  
  
  
`;

const AlbumArt: React.FC<AlbumArtProps> = ({ currentTrack = null, accentColor }) => {
  if (!currentTrack) return null;
  return (
    
      <AlbumArtContainer accentColor={accentColor} >
        {currentTrack?.image && (
          <img
            src={currentTrack.image}
            alt={currentTrack.name}
            style={{
              
              // objectPosition: objectPosition,
              // width: `calc(100% - ${theme.spacing.sm })`,
              // height: `calc(100% - ${theme.spacing.sm})`,
              scale: '1.03',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              overflow: 'hidden',
              borderRadius: '1.25rem',
              position: 'relative',
              display: 'block',
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentTrack.name || 'No Image')}`;
            }}
          />
        )}
      </AlbumArtContainer>
    
  );
};

export default AlbumArt; 