import styled from 'styled-components';
import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}

const StyledAvatar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.gray[700]};
`;

const StyledAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const StyledAvatarFallback = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.muted.foreground};
`;

export const Avatar: React.FC<AvatarProps> = ({ src, alt, fallback, style }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  return (
    <StyledAvatar style={style}>
      {src && !imageError && (
        <StyledAvatarImage 
          src={src} 
          alt={alt} 
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      {(!src || imageError || !imageLoaded) && fallback && (
        <StyledAvatarFallback>
          {fallback}
        </StyledAvatarFallback>
      )}
    </StyledAvatar>
  );
};

