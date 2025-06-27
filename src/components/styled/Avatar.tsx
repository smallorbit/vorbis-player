import styled from 'styled-components';

interface AvatarProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

interface AvatarImageProps {
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
}

interface AvatarFallbackProps {
  children: React.ReactNode;
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

export const Avatar: React.FC<AvatarProps> = ({ children, style }) => {
  return <StyledAvatar style={style}>{children}</StyledAvatar>;
};

export const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt, style }) => {
  return <StyledAvatarImage src={src} alt={alt} style={style} />;
};

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({ children, style }) => {
  return <StyledAvatarFallback style={style}>{children}</StyledAvatarFallback>;
};